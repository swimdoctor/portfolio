module.exports = ({ github, context }) => {
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
		const tags = [...source.matchAll(/<meta[^>]+name=["']project-tag["'][^>]+content=["']([^"']*)["']/gi)]
			.map((match) => match[1].trim())
			.filter(Boolean);

		return { id, title, description, image, tags };
	});

	const cardTemplate = (project, linkPrefix = '', assetPrefix = '') => `
	<a class="project-card" data-tags="${project.tags.map((tag) => escapeHtml(tag.toLowerCase())).join(',')}" href="${linkPrefix}${project.id}.html">
		<img class="project-card__image" src="${assetPrefix}${project.image.replace('../', '')}" alt="${escapeHtml(project.title)}">
		<div class="project-card__content">
			<h2>${escapeHtml(project.title)}</h2>
			<p>${escapeHtml(project.description)}</p>
			<ul class="tag-list" aria-label="Project tags">${project.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>
		</div>
	</a>`;

	const tagTemplate = (projectList) => {
		const tagCounts = new Map();
		projectList.forEach((project) => project.tags.forEach((tag) => {
			const key = tag.toLowerCase();
			const existing = tagCounts.get(key);
			tagCounts.set(key, { label: existing?.label || tag, count: (existing?.count || 0) + 1 });
		}));

		const buttons = [...tagCounts.values()]
			.sort((first, second) => first.label.localeCompare(second.label))
			.map(({ label, count }) => `<button class="filter-button" type="button" aria-pressed="false" data-filter="${escapeHtml(label.toLowerCase())}">${escapeHtml(label)} | ${count}</button>`)
			.join('');

		return `<span class="filter-label">Filter by tag</span>
		<button class="filter-button is-active" type="button" aria-pressed="true" data-filter="all">All projects | ${projectList.length}</button>
		${buttons}`;
	};

	const renderPage = (path, linkPrefix = '', assetPrefix = '') => {
		let html = read(path);
		html = html.replace(/<!-- project-cards:start -->[\s\S]*?<!-- project-cards:end -->/g, () => {
			const cards = projectData.map((project) => cardTemplate(project, linkPrefix, assetPrefix)).join('');
			return `<!-- project-cards:start -->${cards}\n\t\t\t<!-- project-cards:end -->`;
		});
		html = html.replace(/<!-- project-filters:start -->[\s\S]*?<!-- project-filters:end -->/g, () => `<!-- project-filters:start -->${tagTemplate(projectData)}\n\t\t<!-- project-filters:end -->`);
		FileSystem.writeFileSync(path, html, 'utf8');
	};

		renderPage('index.html', 'projects/');
	renderPage('projects/index.html', '', '../');
	return 'Project cards generated successfully';
};