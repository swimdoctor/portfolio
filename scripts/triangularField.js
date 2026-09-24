(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const points = [];
    const spacing = 150;
    const gradientStops = [
        { position: 0, color: '#F1FFE7' },
        { position: 0.25, color: '#C2E7DA' },
        { position: 0.70, color: '#6290C3' },
        { position: 1, color: '#1A1B41' }
    ];
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let columns = 0;
    let rows = 0;
    let pageWidth = 0;
    let pageHeight = 0;
    let nextPointIndex = 0;
    let animationFrame;

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

    const createPoint = (row, column, totalRows) => {
        const isFirstColumn = column === 0;
        const isLastColumn = column === columns - 1;
        const isFirstRow = row === 0;
        const isLastRow = row === totalRows - 1;
        const isFixedCorner = (isFirstColumn || isLastColumn) && (isFirstRow || isLastRow);
        const pointX = isLastColumn ? pageWidth : column * spacing;
        const pointY = isLastRow ? pageHeight : row * spacing;

        return {
            x: pointX,
            y: pointY,
            originX: pointX,
            originY: pointY,
            velocityX: randomBetween(-0.18, 0.18),
            velocityY: randomBetween(-0.18, 0.18),
            phase: randomBetween(0, Math.PI * 2),
            isFixed: isFixedCorner,
            row,
            column,
            index: nextPointIndex += 1
        };
    };

    // Full rebuild: used when the column count changes (page width changed),
    // since every row's x-positions and fixed corners depend on it.
    const rebuildGrid = () => {
        columns = Math.ceil(pageWidth / spacing) + 1;
        rows = Math.ceil(pageHeight / spacing) + 1;
        points.length = 0;
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                points.push(createPoint(row, column, rows));
            }
        }
    };

    // Recomputes which points in `row` should be pinned as bottom/top corners
    // for a grid that now has `totalRows` rows, snapping the bottom row to
    // the current page height.
    const restampRow = (row, totalRows) => {
        points.filter((point) => point.row === row).forEach((point) => {
            const isFirstColumn = point.column === 0;
            const isLastColumn = point.column === columns - 1;
            const isFirstRow = row === 0;
            const isLastRow = row === totalRows - 1;
            point.isFixed = (isFirstColumn || isLastColumn) && (isFirstRow || isLastRow);
            if (isLastRow) {
                point.y = pageHeight;
                point.originY = pageHeight;
            }
        });
    };

    // Height-only change (e.g. filtering hides cards): append new rows at the
    // bottom when the page grew, or crop rows off the bottom when it
    // shrank, instead of rebuilding the whole mesh and losing its motion.
    const syncRows = () => {
        const targetRows = Math.ceil(pageHeight / spacing) + 1;
        const previousLastRow = rows - 1;

        if (targetRows > rows) {
            for (let row = rows; row < targetRows; row += 1) {
                for (let column = 0; column < columns; column += 1) {
                    points.push(createPoint(row, column, targetRows));
                }
            }
        } else if (targetRows < rows) {
            for (let index = points.length - 1; index >= 0; index -= 1) {
                if (points[index].row >= targetRows) points.splice(index, 1);
            }
        }

        rows = targetRows;
        restampRow(previousLastRow, rows);
        restampRow(rows - 1, rows);
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
    };

    const getCircumcircle = (firstPoint, secondPoint, thirdPoint) => {
        const determinant = 2 * (
            firstPoint.x * (secondPoint.y - thirdPoint.y) +
            secondPoint.x * (thirdPoint.y - firstPoint.y) +
            thirdPoint.x * (firstPoint.y - secondPoint.y)
        );
        if (Math.abs(determinant) < 0.00001) return { x: 0, y: 0, radiusSquared: Infinity };

        const firstSquared = firstPoint.x ** 2 + firstPoint.y ** 2;
        const secondSquared = secondPoint.x ** 2 + secondPoint.y ** 2;
        const thirdSquared = thirdPoint.x ** 2 + thirdPoint.y ** 2;
        const centerX = (firstSquared * (secondPoint.y - thirdPoint.y) + secondSquared * (thirdPoint.y - firstPoint.y) + thirdSquared * (firstPoint.y - secondPoint.y)) / determinant;
        const centerY = (firstSquared * (thirdPoint.x - secondPoint.x) + secondSquared * (firstPoint.x - thirdPoint.x) + thirdSquared * (secondPoint.x - firstPoint.x)) / determinant;
        const distanceX = centerX - firstPoint.x;
        const distanceY = centerY - firstPoint.y;

        return { x: centerX, y: centerY, radiusSquared: distanceX ** 2 + distanceY ** 2 };
    };

    const triangleFromPoints = (firstPoint, secondPoint, thirdPoint) => ({
        firstPoint,
        secondPoint,
        thirdPoint,
        circumcircle: getCircumcircle(firstPoint, secondPoint, thirdPoint)
    });

    const containsPoint = (triangle, point) => {
        const distanceX = triangle.circumcircle.x - point.x;
        const distanceY = triangle.circumcircle.y - point.y;
        return distanceX ** 2 + distanceY ** 2 <= triangle.circumcircle.radiusSquared;
    };

    const edgeKey = (firstPoint, secondPoint) => [firstPoint.index, secondPoint.index].sort((first, second) => first - second).join(':');

    const triangulate = () => {
        const superTrianglePadding = Math.max(pageWidth, pageHeight) * 4;
        const superTriangle = [
            { x: -superTrianglePadding, y: pageHeight + superTrianglePadding, index: -1 },
            { x: pageWidth / 2, y: -superTrianglePadding, index: -2 },
            { x: pageWidth + superTrianglePadding, y: pageHeight + superTrianglePadding, index: -3 }
        ];
        let triangles = [triangleFromPoints(...superTriangle)];

        points.forEach((point) => {
            const badTriangles = triangles.filter((triangle) => containsPoint(triangle, point));
            const boundaryEdges = new Map();

            badTriangles.forEach((triangle) => {
                [[triangle.firstPoint, triangle.secondPoint], [triangle.secondPoint, triangle.thirdPoint], [triangle.thirdPoint, triangle.firstPoint]].forEach(([firstPoint, secondPoint]) => {
                    const key = edgeKey(firstPoint, secondPoint);
                    const edge = boundaryEdges.get(key);
                    if (edge) edge.count += 1;
                    else boundaryEdges.set(key, { firstPoint, secondPoint, count: 1 });
                });
            });

            triangles = triangles.filter((triangle) => !badTriangles.includes(triangle));
            boundaryEdges.forEach((edge) => {
                if (edge.count === 1) triangles.push(triangleFromPoints(edge.firstPoint, edge.secondPoint, point));
            });
        });

        return triangles.filter((triangle) => [triangle.firstPoint, triangle.secondPoint, triangle.thirdPoint].every((point) => point.index >= 0));
    };

    const hexToRgb = (hexColor) => [1, 3, 5].map((index) => parseInt(hexColor.slice(index, index + 2), 16));
    const rgbToHex = (red, green, blue) => `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
    const colorAtHeight = (height) => {
        const amount = Math.max(0, Math.min(1, height / pageHeight));
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

    const drawTriangle = (triangle) => {
        const { firstPoint, secondPoint, thirdPoint } = triangle;
        const centerY = (firstPoint.y + secondPoint.y + thirdPoint.y) / 3;
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        context.lineTo(secondPoint.x, secondPoint.y);
        context.lineTo(thirdPoint.x, thirdPoint.y);
        context.closePath();
        context.fillStyle = colorAtHeight(centerY);
        context.fill();
    };

    const updatePoints = (time) => {
        points.forEach((point) => {
            if (prefersReducedMotion || point.isFixed) return;
            point.x += point.velocityX;
            point.y += point.velocityY;
            point.x += Math.sin(time * 0.00025 + point.phase) * 0.08;
            point.y += Math.cos(time * 0.0002 + point.phase) * 0.08;

            if (point.x < point.originX - 28 || point.x > point.originX + 28) point.velocityX *= -1;
            if (point.y < point.originY - 28 || point.y > point.originY + 28) point.velocityY *= -1;
        });
    };

    const drawField = (time) => {
        context.clearRect(0, 0, pageWidth, pageHeight);
        updatePoints(time);

        triangulate().forEach(drawTriangle);

        animationFrame = window.requestAnimationFrame(drawField);
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('load', resizeCanvas);
    if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(document.body);
    resizeCanvas();
    animationFrame = window.requestAnimationFrame(drawField);

    window.addEventListener('pagehide', () => window.cancelAnimationFrame(animationFrame));
})();
