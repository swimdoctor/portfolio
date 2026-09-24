(() => {
    const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content.trim() || '';
    const title = getMeta('project-title');
    const startDate = getMeta('project-start-date') || getMeta('project-date');
    const endDate = getMeta('project-end-date');
    const description = getMeta('project-description');
    const image = getMeta('project-image');
    const imageAlt = getMeta('project-image-alt');
    const tags = [...document.querySelectorAll('meta[name="project-tag"]')]
        .map((tag) => tag.content.trim())
        .filter(Boolean);

    document.title = `${title} | Dylan's Portfolio`;
    document.querySelector('[data-project-field="title"]')?.replaceChildren(document.createTextNode(title));
    document.querySelector('[data-project-field="description"]')?.replaceChildren(document.createTextNode(description));

    const eyebrow = document.querySelector('[data-project-field="eyebrow"]');
    const date = endDate ? `${startDate} - ${endDate}` : startDate;
    if (eyebrow) eyebrow.textContent = date;

    const tagList = document.querySelector('[data-project-field="tags"]');
    if (tagList) {
        tagList.replaceChildren(...tags.map((tag) => {
            const item = document.createElement('li');
            item.textContent = tag;
            return item;
        }));
    }

    const projectImage = document.querySelector('[data-project-field="image"]');
    if (projectImage) {
        projectImage.src = image;
        projectImage.alt = imageAlt || title;
    }
})();
