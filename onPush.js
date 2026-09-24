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

	const projectData = projects.map((id) => {
		const source = read(`projects/${id}.html`);
		const title = metadata(source, 'project-title') || id;
		const description = metadata(source, 'project-description');
		const image = metadata(source, 'project-image');
		const imageAlt = metadata(source, 'project-image-alt');
		const tags = [...source.matchAll(/<meta[^>]+name=["']project-tag["'][^>]+content=["']([^"']*)["']/gi)]
			.map((match) => match[1].trim())
			.filter(Boolean);

		return { id, title, description, image, imageAlt, tags };
	});

	const cardTemplate = (project, { linkPrefix = '', assetPrefix = '', reverse = false, indent = '' } = {}) => {
		const pad = (level) => indent + '    '.repeat(level);
		const tagItems = project.tags.map((tag) => `${pad(3)}<li>${escapeHtml(tag)}</li>`).join('\n');

		return `${pad(0)}<a class="project-card${reverse ? ' project-card--reverse' : ''}" data-tags="${project.tags.map((tag) => escapeHtml(tag.toLowerCase())).join(',')}" href="${linkPrefix}${project.id}.html">
${pad(1)}<img class="project-card__image" src="${assetPrefix}${project.image.replace('../', '')}" alt="${escapeHtml(project.imageAlt || project.title)}">
${pad(1)}<div class="project-card__content">
${pad(2)}<h2>${escapeHtml(project.title)}</h2>
${pad(2)}<p>${escapeHtml(project.description)}</p>
${pad(2)}<ul class="tag-list" aria-label="Project tags">
${tagItems}
${pad(2)}</ul>
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

	const renderPage = (path, linkPrefix = '', assetPrefix = '') => {
		let html = read(path);
		html = html.replace(/^([ \t]*)<!-- project-cards:start -->[\s\S]*?<!-- project-cards:end -->/m, (match, indent) => {
			const cards = projectData
				.map((project, index) => cardTemplate(project, { linkPrefix, assetPrefix, reverse: linkPrefix === 'projects/' && index % 2 === 1, indent }))
				.join('\n');
			return `${indent}<!-- project-cards:start -->\n${cards}\n${indent}<!-- project-cards:end -->`;
		});
		html = html.replace(/^([ \t]*)<!-- project-filters:start -->[\s\S]*?<!-- project-filters:end -->/m, (match, indent) => `${indent}<!-- project-filters:start -->\n${tagTemplate(projectData, indent)}\n${indent}<!-- project-filters:end -->`);
		FileSystem.writeFileSync(path, html, 'utf8');
	};

	renderPage('index.html', 'projects/');
	renderPage('projects/index.html', '', '../');
	return 'Project cards generated successfully';
};
