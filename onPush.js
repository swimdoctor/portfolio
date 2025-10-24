module.exports = ({github, context}) => {	
	File.writeFileSync('onPush.txt', 'test');

	return 'onPush.js executed successfully';
}