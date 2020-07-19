const path = require('path')
const {spawn} = require('child_process')

function moveBot(lmot, rmot, speed){
   return spawn('python', ["-u", path.join(__dirname, 'motorTest.py'), lmot, rmot, speed]);
}
const subprocess = moveBot(-100,-100,1000);

subprocess.stdout.on('data', (data) => {
   console.log(`data:${data}`);
});
subprocess.stderr.on('data', (data) => {
   console.log(`error:${data}`);
});
subprocess.stderr.on('close', () => {
   //console.log("Closed");
});
