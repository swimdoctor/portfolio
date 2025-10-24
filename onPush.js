module.exports = ({github, context}) => {
	console.log('The value sent in the client payload is:', context.payload.client_payload.value)
	
	File.writeFileSync('onPush.txt', 'test');
	
	return context.payload.client_payload.value
}