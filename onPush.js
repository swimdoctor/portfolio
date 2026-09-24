module.exports = ({ github, context }) => {
	const FileSystem = require('fs');
	const read = (path) => FileSystem.readFileSync(path, 'utf8');
	const projects = FileSystem.readdirSync('projects')
		.filter((file) => file.endsWith('.html') && file !== 'index.html')
		.map((file) => file.replace(/\.html$/i, ''));
	const escapeHtml = (value) => value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
	const metadata = (source, name) => source.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1].trim() || '';

	// Converts a "Month Year" string into a lexicographically sortable "YYYY-MM"
	// key. Unparseable or unknown dates (e.g. "Unknown") sort as the earliest
	// possible date, so they fall last in a "most recent first" sort.
	const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
	const monthYearToSortKey = (text) => {
		const match = text.trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
		const monthIndex = match ? MONTHS.indexOf(match[1]) : -1;
		return monthIndex === -1 ? '0000-00' : `${match[2]}-${String(monthIndex + 1).padStart(2, '0')}`;
	};

	const projectData = projects.map((id) => {
		const source = read(`projects/${id}.html`);
		const title = metadata(source, 'project-title') || id;
		const description = metadata(source, 'project-description');
		const image = metadata(source, 'project-image');
		const imageAlt = metadata(source, 'project-image-alt');
		const startDate = metadata(source, 'project-start-date') || metadata(source, 'project-date');
		const endDate = metadata(source, 'project-end-date');
		const date = endDate ? `${startDate} - ${endDate}` : startDate;
		const endSortKey = monthYearToSortKey(endDate || startDate);
		// 0 (or missing/non-numeric) = not featured; 1-n = featured, in that order.
		const featuredOrder = parseInt(metadata(source, 'project-featured'), 10) || 0;
		const tags = [...source.matchAll(/<meta[^>]+name=["']project-tag["'][^>]+content=["']([^"']*)["']/gi)]
			.map((match) => match[1].trim())
			.filter(Boolean);

		return { id, title, description, image, imageAlt, date, endSortKey, featuredOrder, tags };
	});

	// Home page sections, in display order. Each lists projects that carry
	// the category's tag (case-insensitive) AND have a positive project-featured
	// order, sorted by that order; the archive ignores project-featured and
	// always lists everything.
	const homeCategories = [
		{ slug: 'machine-learning', tag: 'machine learning' },
		{ slug: 'games', tag: 'game' },
		{ slug: 'computer-graphics', tag: 'computer graphics' }
	];

	const cardTemplate = (project, { linkPrefix = '', assetPrefix = '', reverse = false, indent = '', variant = 'featured' } = {}) => {
		const pad = (level) => indent + '    '.repeat(level);
		const tagItems = project.tags.map((tag) => `${pad(3)}<li>${escapeHtml(tag)}</li>`).join('\n');
		const classes = ['project-card'];
		if (reverse) classes.push('project-card--reverse');
		if (variant === 'archive') classes.push('project-card--compact');

		// Archive cards are compact: title, date, tags, then summary underneath.
		// Featured (home) cards stay title, summary, tags, next to the image.
		const content = variant === 'archive'
			? `${pad(2)}<h2>${escapeHtml(project.title)}</h2>
${pad(2)}<p class="project-card__meta">${escapeHtml(project.date)}</p>
${pad(2)}<ul class="tag-list" aria-label="Project tags">
${tagItems}
${pad(2)}</ul>
${pad(2)}<p>${escapeHtml(project.description)}</p>`
			: `${pad(2)}<h2>${escapeHtml(project.title)}</h2>
${pad(2)}<p>${escapeHtml(project.description)}</p>
${pad(2)}<ul class="tag-list" aria-label="Project tags">
${tagItems}
${pad(2)}</ul>`;

		const endSortAttr = variant === 'archive' ? ` data-end-sort="${project.endSortKey}"` : '';

		return `${pad(0)}<a class="${classes.join(' ')}" data-tags="${project.tags.map((tag) => escapeHtml(tag.toLowerCase())).join(',')}"${endSortAttr} href="${linkPrefix}${project.id}.html">
${pad(1)}<img class="project-card__image" src="${assetPrefix}${project.image.replace('../', '')}" alt="${escapeHtml(project.imageAlt || project.title)}">
${pad(1)}<div class="project-card__content">
${content}
${pad(1)}</div>
${pad(0)}</a>`;
	};

	const tagTemplate = (projectList, indent = '') => {
		const tagCounts = new Map();
		projectList.forEach((project) => project.tags.forEach((tag) => {
			const key = tag.toLowerCase();
			const existing = tagCounts.get(key);
			tagCounts.set(key, { label: existing?.label || tag, count: (existing?.count || 0) + 1 });
		}));

		const buttons = [...tagCounts.values()]
			.sort((first, second) => first.label.localeCompare(second.label))
			.map(({ label, count }) => `${indent}<button class="filter-button" type="button" aria-pressed="false" data-label="${escapeHtml(label)}" data-filter="${escapeHtml(label.toLowerCase())}">${escapeHtml(label)} | ${count}</button>`)
			.join('\n');

		return [
			`${indent}<span class="filter-label">Filter by tag</span>`,
			`${indent}<button class="filter-button is-active" type="button" aria-pressed="true" data-label="All projects" data-filter="all">All projects | ${projectList.length}</button>`,
			buttons
		].join('\n');
	};

	// Home page: one card block per category, each matched by tag.
	const renderHomePage = (path) => {
		let html = read(path);
		homeCategories.forEach((category) => {
			const regex = new RegExp(`^([ \\t]*)<!-- project-cards:${category.slug}:start -->[\\s\\S]*?<!-- project-cards:${category.slug}:end -->`, 'm');
			html = html.replace(regex, (match, indent) => {
				const matches = projectData
					.filter((project) => project.featuredOrder > 0 && project.tags.some((tag) => tag.toLowerCase() === category.tag))
					.sort((first, second) => first.featuredOrder - second.featuredOrder);
				const cards = matches
					.map((project, index) => cardTemplate(project, { linkPrefix: 'projects/', reverse: index % 2 === 1, indent, variant: 'featured' }))
					.join('\n');
				const body = cards ? `\n${cards}\n${indent}` : '\n';
				return `${indent}<!-- project-cards:${category.slug}:start -->${body}<!-- project-cards:${category.slug}:end -->`;
			});
		});
		FileSystem.writeFileSync(path, html, 'utf8');
	};

	// Archive page: one flat list of every project, plus the tag filter buttons.
	const renderArchivePage = (path) => {
		let html = read(path);
		html = html.replace(/^([ \t]*)<!-- project-cards:start -->[\s\S]*?<!-- project-cards:end -->/m, (match, indent) => {
			const cards = projectData
				.map((project) => cardTemplate(project, { assetPrefix: '../', indent, variant: 'archive' }))
				.join('\n');
			return `${indent}<!-- project-cards:start -->\n${cards}\n${indent}<!-- project-cards:end -->`;
		});
		html = html.replace(/^([ \t]*)<!-- project-filters:start -->[\s\S]*?<!-- project-filters:end -->/m, (match, indent) => `${indent}<!-- project-filters:start -->\n${tagTemplate(projectData, indent)}\n${indent}<!-- project-filters:end -->`);
		FileSystem.writeFileSync(path, html, 'utf8');
	};

	renderHomePage('index.html');
	renderArchivePage('projects/index.html');
	return 'Project cards generated successfully';
};
