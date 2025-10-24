module.exports = ({github, context}) => {	
	var indexHtml = FileSystem.readFileSync('index.html', 'utf8')
	indexHtml = indexHtml.replace(/(?<=<div class="project">\n).*(?=\n\s*<\/div>)/gms, (match) => {
		var projects = ["CraftUp"]


		var newProjectSection = ""
		projects.forEach(project => {
			var projectFile = FileSystem.readFileSync('projects/' + project + '.html', 'utf8')
			var projectInfo = projectFile.match(/(?<=<main>\n).*(?=\n\s*<\/main>)/gms)
			var projectName = projectInfo.match(/(?<=<h1>).*(?=<\/h1>)/gms)
			var projectDate = projectInfo.match(/(?<=<h3>).*(?=<\/h3>)/gms)
			var projectImagePath = projectInfo.match(/(?<=<img src=").*(?=" alt)/g)
			var projectDescription = projectInfo.match(/(?<=<h2>).*(?=<\/h2>)/gms)
			
			newProjectSection += "<img src=\"" + projectImagePath + "\" alt = \"" + projectName + " Logo\">"
			newProjectSection += "<h1>" + projectName + "</h1>"
			newProjectSection += "<h3>" + projectDate + "</h3>"
			newProjectSection += "<p class = \"projectDescription\">" + projectDescription + "</h2>"
		})

		return newProjectSection
	})
	FileSystem.writeFileSync('index.html', indexHtml, 'utf8')

	return 'onPush.js executed successfully'
}