(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const points = [];
    const spacing = 150;
    const driftRange = 28;
    // Only points (and the triangles around them) within this fraction of the
    // viewport height above/below the viewport are animated and redrawn.
    const viewportMargin = 0.2;
    // A cell only switches diagonal once the alternative is clearly better, so
    // near-ties don't flicker between the two.
    const diagonalFlipThreshold = 1e4;
    const gradientSteps = 1024;
    const gradientStops = [
        { position: 0, color: '#C2E7DA' },
        { position: 0.35, color: '#6290C3' },
        { position: 1, color: '#1A1B41' }
    ];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let columns = 0;
    let rows = 0;
    let pageWidth = 0;
    let pageHeight = 0;
    let animationFrame;
    let needsRedraw = true;
    // One flag per grid cell: 0 splits it top-left/bottom-right, 1 top-right/bottom-left.
    let diagonals = new Uint8Array(0);

    canvas.className = 'point-field';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const randomBetween = (minimum, maximum) => Math.random() * (maximum - minimum) + minimum;

    // The canvas itself is an absolutely-positioned descendant of body, so an
    // explicit inline height on it can inflate body/document scrollHeight.
    // Measuring with that height temporarily zeroed keeps the reading tied to
    // actual page content, so the mesh can shrink back down, not just grow.
    const measurePageHeight = () => {
        const previousHeight = canvas.style.height;
        canvas.style.height = '0px';
        const measured = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
        canvas.style.height = previousHeight;
        return measured;
    };

    // Rounding (rather than ceiling) keeps the last row/column between half
    // and one-and-a-half spacings from its neighbor, so a sliver-thin final
    // cell can never be folded over by its neighbor's drift.
    const columnCountForWidth = () => Math.max(2, Math.round(pageWidth / spacing) + 1);
    const rowCountForHeight = () => Math.max(2, Math.round(pageHeight / spacing) + 1);

    // Edge points may only slide along their edge (left/right column keep x,
    // top/bottom row keep y) so the mesh hull always equals the page rectangle
    // and no background shows through at the borders. Corners are both.
    const applyPinning = (point, totalRows) => {
        point.lockX = point.column === 0 || point.column === columns - 1;
        point.lockY = point.row === 0 || point.row === totalRows - 1;
    };

    const createPoint = (row, column, totalRows) => {
        const isLastColumn = column === columns - 1;
        const isLastRow = row === totalRows - 1;
        const pointX = isLastColumn ? pageWidth : column * spacing;
        const pointY = isLastRow ? pageHeight : row * spacing;

        const point = {
            x: pointX,
            y: pointY,
            originX: pointX,
            originY: pointY,
            velocityX: randomBetween(-0.18, 0.18),
            velocityY: randomBetween(-0.18, 0.18),
            phase: randomBetween(0, Math.PI * 2),
            row,
            column
        };
        applyPinning(point, totalRows);
        return point;
    };

    // Points are stored row-major, so the point at (row, column) is
    // points[row * columns + column].
    // Full rebuild: used when the column count changes (page width changed),
    // since every row's x-positions and fixed corners depend on it.
    const rebuildGrid = () => {
        columns = columnCountForWidth();
        rows = rowCountForHeight();
        points.length = 0;
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                points.push(createPoint(row, column, rows));
            }
        }
        diagonals = new Uint8Array((rows - 1) * (columns - 1));
    };

    // Recomputes which points in `row` should be pinned as bottom/top edge
    // points for the current row count, snapping the bottom row to the
    // current page height.
    const restampRow = (row) => {
        if (row < 0 || row >= rows) return;
        for (let column = 0; column < columns; column += 1) {
            const point = points[row * columns + column];
            applyPinning(point, rows);
            if (row === rows - 1) {
                point.y = pageHeight;
                point.originY = pageHeight;
            }
        }
    };

    // Height-only change (e.g. filtering hides cards): append new rows at the
    // bottom when the page grew, or crop rows off the bottom when it
    // shrank, instead of rebuilding the whole mesh and losing its motion.
    const syncRows = () => {
        const targetRows = rowCountForHeight();
        const previousLastRow = rows - 1;

        if (targetRows > rows) {
            for (let row = rows; row < targetRows; row += 1) {
                for (let column = 0; column < columns; column += 1) {
                    points.push(createPoint(row, column, targetRows));
                }
            }
        } else if (targetRows < rows) {
            points.length = targetRows * columns;
        }

        rows = targetRows;
        const resizedDiagonals = new Uint8Array((rows - 1) * (columns - 1));
        resizedDiagonals.set(diagonals.subarray(0, Math.min(resizedDiagonals.length, diagonals.length)));
        diagonals = resizedDiagonals;

        restampRow(previousLastRow);
        restampRow(rows - 1);
    };

    const resizeCanvas = () => {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const newWidth = document.documentElement.clientWidth;
        const newHeight = measurePageHeight();
        const widthChanged = newWidth !== pageWidth;

        pageWidth = newWidth;
        pageHeight = newHeight;
        canvas.width = pageWidth * pixelRatio;
        canvas.height = pageHeight * pixelRatio;
        canvas.style.width = `${pageWidth}px`;
        canvas.style.height = `${pageHeight}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        if (widthChanged || points.length === 0) rebuildGrid();
        else syncRows();
        needsRedraw = true;
    };

    // Which of a cell's two diagonals to draw, given its corners in order
    // (top-left, top-right, bottom-right, bottom-left): the Delaunay one, i.e.
    // the diagonal whose triangles' circumcircles don't contain the fourth
    // corner. That is exactly what a full Delaunay triangulation picks for
    // this near-grid of points, at a tiny fraction of the cost. If the cell
    // is not convex, only one diagonal lies inside it, so that one is forced.
    const side = (from, to, point) => (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
    const chooseDiagonal = (topLeft, topRight, bottomRight, bottomLeft, current) => {
        const backSlashValid = side(topLeft, bottomRight, topRight) * side(topLeft, bottomRight, bottomLeft) < 0;
        const forwardSlashValid = side(topRight, bottomLeft, topLeft) * side(topRight, bottomLeft, bottomRight) < 0;
        if (backSlashValid !== forwardSlashValid) return backSlashValid ? 0 : 1;

        const ax = topLeft.x - bottomLeft.x;
        const ay = topLeft.y - bottomLeft.y;
        const bx = topRight.x - bottomLeft.x;
        const by = topRight.y - bottomLeft.y;
        const cx = bottomRight.x - bottomLeft.x;
        const cy = bottomRight.y - bottomLeft.y;
        const inCircle = (
            (ax * ax + ay * ay) * (bx * cy - cx * by) -
            (bx * bx + by * by) * (ax * cy - cx * ay) +
            (cx * cx + cy * cy) * (ax * by - bx * ay)
        ) * Math.sign(side(topLeft, topRight, bottomRight));

        if (inCircle > diagonalFlipThreshold) return 1;
        if (inCircle < -diagonalFlipThreshold) return 0;
        return current;
    };

    const hexToRgb = (hexColor) => [1, 3, 5].map((index) => parseInt(hexColor.slice(index, index + 2), 16));
    const rgbToHex = (red, green, blue) => `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
    const colorAtAmount = (amount) => {
        const upperStop = gradientStops.find((stop) => stop.position >= amount) || gradientStops[gradientStops.length - 1];
        const upperIndex = gradientStops.indexOf(upperStop);
        const lowerStop = gradientStops[Math.max(0, upperIndex - 1)];
        const stopRange = upperStop.position - lowerStop.position || 1;
        const localAmount = Math.max(0, Math.min(1, (amount - lowerStop.position) / stopRange));
        const lowerRgb = hexToRgb(lowerStop.color);
        const upperRgb = hexToRgb(upperStop.color);
        return rgbToHex(
            lowerRgb[0] + (upperRgb[0] - lowerRgb[0]) * localAmount,
            lowerRgb[1] + (upperRgb[1] - lowerRgb[1]) * localAmount,
            lowerRgb[2] + (upperRgb[2] - lowerRgb[2]) * localAmount
        );
    };

    // The gradient depends only on the normalized page position, so it is
    // sampled once here instead of being recomputed for every triangle.
    const gradientLookup = Array.from({ length: gradientSteps }, (_, step) => colorAtAmount(step / (gradientSteps - 1)));
    const colorAtHeight = (height) => {
        const amount = Math.max(0, Math.min(1, height / pageHeight));
        return gradientLookup[Math.round(amount * (gradientSteps - 1))];
    };

    const drawTriangle = (firstPoint, secondPoint, thirdPoint) => {
        const centerY = (firstPoint.y + secondPoint.y + thirdPoint.y) / 3;
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        context.lineTo(secondPoint.x, secondPoint.y);
        context.lineTo(thirdPoint.x, thirdPoint.y);
        context.closePath();
        context.fillStyle = colorAtHeight(centerY);
        context.fill();
    };

    const drawCell = (row, column) => {
        const topLeft = points[row * columns + column];
        const topRight = points[row * columns + column + 1];
        const bottomLeft = points[(row + 1) * columns + column];
        const bottomRight = points[(row + 1) * columns + column + 1];
        const cellIndex = row * (columns - 1) + column;
        const diagonal = chooseDiagonal(topLeft, topRight, bottomRight, bottomLeft, diagonals[cellIndex]);
        diagonals[cellIndex] = diagonal;

        if (diagonal) {
            drawTriangle(topLeft, topRight, bottomLeft);
            drawTriangle(topRight, bottomRight, bottomLeft);
        } else {
            drawTriangle(topLeft, topRight, bottomRight);
            drawTriangle(topLeft, bottomRight, bottomLeft);
        }
    };

    const rowAtHeight = (height) => Math.max(0, Math.min(rows - 1, Math.floor(height / spacing)));

    const updatePoints = (time, firstRow, lastRow) => {
        for (let index = firstRow * columns; index < (lastRow + 1) * columns; index += 1) {
            const point = points[index];
            if (!point.lockX) {
                point.x += point.velocityX + Math.sin(time * 0.00025 + point.phase) * 0.08;
                if (point.x < point.originX - driftRange || point.x > point.originX + driftRange) point.velocityX *= -1;
            }
            if (!point.lockY) {
                point.y += point.velocityY + Math.cos(time * 0.0002 + point.phase) * 0.08;
                if (point.y < point.originY - driftRange || point.y > point.originY + driftRange) point.velocityY *= -1;
            }
        }
    };

    // Only the band around the viewport is moved and repainted. Points outside
    // it stay put, and so does the pixel content already painted there, until
    // scrolling brings that part of the page back into the band.
    const drawField = (time) => {
        animationFrame = window.requestAnimationFrame(drawField);
        if (prefersReducedMotion && !needsRedraw) return;
        needsRedraw = false;

        const margin = window.innerHeight * viewportMargin;
        const bandTop = Math.max(0, Math.floor(window.scrollY - margin));
        const bandBottom = Math.min(pageHeight, Math.ceil(window.scrollY + window.innerHeight + margin));
        // Points can drift `driftRange` off their row, so widen the band by a
        // row on each side to be sure every cell touching it gets redrawn.
        const firstRow = Math.max(0, rowAtHeight(bandTop) - 1);
        const lastRow = Math.min(rows - 1, rowAtHeight(bandBottom) + 2);

        if (!prefersReducedMotion) updatePoints(time, firstRow, lastRow);

        context.save();
        context.beginPath();
        context.rect(0, bandTop, pageWidth, bandBottom - bandTop);
        context.clip();
        context.clearRect(0, bandTop, pageWidth, bandBottom - bandTop);
        for (let row = Math.max(0, firstRow - 1); row <= Math.min(rows - 2, lastRow); row += 1) {
            for (let column = 0; column < columns - 1; column += 1) drawCell(row, column);
        }
        context.restore();
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('load', resizeCanvas);
    window.addEventListener('scroll', () => { needsRedraw = true; }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(document.body);
    resizeCanvas();
    animationFrame = window.requestAnimationFrame(drawField);

    window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationFrame));
})();
