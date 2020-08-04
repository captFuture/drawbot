// initial variables
var stepMultiplier;

// button and page handling
var settingsPage = document.querySelector('#view_settings');
var movePage = document.querySelector('#view_move');
var progressPage = document.querySelector('#view_progress');
var settingsAside = document.querySelector('#aside_settings');
var moveAside = document.querySelector('#aside_move');
var selectFilePage = document.querySelector('#view_folder');

var folderButton = document.querySelector('#button_folder');
var settingsButton = document.querySelector('#button_settings');
var moveButton = document.querySelector('#button_move');
var progressButton = document.querySelector('#button_progress');
var cancelButton = document.querySelector('#button_cancel');
var mainNavigation = document.querySelectorAll("#mainNavigation > button");

var multiplierOneButton = document.querySelector('#button_multiplier_one');
var multiplierTenButton = document.querySelector('#button_multiplier_ten');
var multiplierOnehundredButton = document.querySelector('#button_multiplier_onehundred');
var penButton = document.querySelector('#button_pen');

var homeButton = document.querySelector('#button_arrow_home');
var leftButton = document.querySelector('#button_arrowe_left');
var rightButton = document.querySelector('#button_arrow_right');
var upButton = document.querySelector('#button_arrow_up');
var downButton = document.querySelector('#button_arrow_down');

var connectionIndicator = document.querySelector('#connection')

toggleMultiplier(100);

var socket = io.connect('/');
socket.on('connected', function (data) {
    //console.log('connected!');
    socket.emit('getDXY');
    socket.emit('checkBotConnection', { socketID: socket.id });
});

var flipper = document.querySelector('#main');

var penz = 0;
let pads = document.querySelectorAll('.item');
for (var i = 0; i < pads.length; i++) {
    console.log(pads[i])
    let pad = pads[i];
    pad.addEventListener('click', handleTouch);
}

function handleTouch(e) {
    e.preventDefault()
    var data = this.dataset
    data.d = 2
    data.steps = stepMultiplier
    console.log(data)
    socket.emit('r', data)
    console.log(data);
}

penButton.addEventListener('click', function (e) {
    penz = !penz// swap pen position
    var data = {
        up: penz
    }
    socket.emit('pen', data);
});


homeButton.addEventListener('click', function(e) {
    console.log("Set Home");
    var data = { x: 0, y: 0 };
    socket.emit('setH', data);
  });
  
  folderButton.addEventListener('click', function(e) {
      toggleActiveState(folderButton);
      toggleSelectFile();
      var data = {folder:'../public/files/', order:'asc', limit:'5'}
      socket.emit('filelist', data);
  });  
  settingsButton.addEventListener('click', function(e) {
      toggleActiveState(settingsButton);
      toggleSettings();
  });
  moveButton.addEventListener('click', function(e) {
    toggleActiveState(moveButton);
    toggleMove();
  });
  progressButton.addEventListener('click', function(e) {
    toggleActiveState(progressButton);
    toggleProgress();
  });

  function toggleSelectFile() {
    settingsPage.classList.remove('on');
    movePage.classList.remove('on');
    progressPage.classList.remove('on');
    selectFilePage.classList.add('on');
    
    settingsAside.classList.remove('on');
    moveAside.classList.remove('on');
  }

  function toggleSettings() {
    settingsPage.classList.add('on');
    movePage.classList.remove('on');
    progressPage.classList.remove('on');
    selectFilePage.classList.remove('on');
    
    settingsAside.classList.add('on');
    moveAside.classList.remove('on');
  }
  
  function toggleMove() {
      settingsPage.classList.remove('on');
      movePage.classList.add('on');
      progressPage.classList.remove('on');
      selectFilePage.classList.remove('on');
  
      settingsAside.classList.remove('on');
      moveAside.classList.add('on');
  }
    
  function toggleProgress() {
      settingsPage.classList.remove('on');
      movePage.classList.remove('on');
      progressPage.classList.add('on');
      selectFilePage.classList.remove('on');
  
      settingsAside.classList.remove('on');
      moveAside.classList.remove('on');
  }
  
  function toggleActiveState(button){
    mainNavigation.forEach(function(item) {
      item.classList.remove('active');
    });
    button.classList.add('active');
  }

/*var clearcanvasButton = document.querySelector('.clearcanvas');
clearcanvasButton.addEventListener('click', function (e) {
    socket.emit('clearCanvas')
})*/

var percentageIndicator = document.querySelector('#percentage')
var ri = radialIndicator('#percentage', {
    barColor: 'gray',
    barWidth: 5,
    initValue: 0,
    radius: 15,
    percentage: true
})
socket.on('progressUpdate', function (data) {
    ri.animate(data.percentage)
});

socket.on('drewieFiles', function (data) {
    var filelist=document.getElementById('filelist');
    //console.log(data.drewiefiles);
    var htmlbuffer = "";
    for(var i=0;i<data.drewiefiles.length;i++){
        htmlbuffer += '<button class="filelist">';
        htmlbuffer += '<span class="drawfile" onClick="readFile(\''+data.drewiefiles[i].trim()+'\')" data-filename="'+data.drewiefiles[i]+'" id="file_'+i+'">';
        htmlbuffer += data.drewiefiles[i].replace(".svg","");
        htmlbuffer += '</span>';
        htmlbuffer += '</button>';
        
    }
    filelist.innerHTML=htmlbuffer;
});

socket.on('penState', function (data) {

    var penButton = document.getElementById("button_pen");
    //console.log("MyPen:"+data);
    switch (data) {
        case 0:
            // pen is down
            penButton.classList.remove('up')
            penButton.classList.add('down')
        break

        case 1:
            // pen is up
            penButton.classList.remove('down')
            penButton.classList.add('up')
        break
    }
});

function crossHair(x,y,pen) {
    //console.log(data);
    var crosshair = document.getElementById("crosshair");
    var posctx = crosshair.getContext("2d");

    posctx.clearRect(0,0,crosshair.width,crosshair.height);
    posctx.beginPath();
    if(pen == 1){
        posctx.lineWith = "2";
        posctx.strokeStyle = "#FF0000";
    }else{
        posctx.lineWith = "2";
        posctx.strokeStyle = "#00FF00";
    }
   
    posctx.moveTo(x - 20, y);
    posctx.lineTo(x + 20, y);
    posctx.stroke();
    posctx.beginPath();
    posctx.moveTo(x, y - 20);
    posctx.lineTo(x, y + 20);

    posctx.stroke();
}

  multiplierOneButton.addEventListener('click', function(e) {
    toggleMultiplier(10);
  });
  multiplierTenButton.addEventListener('click', function(e) {
    toggleMultiplier(100);
  });
  multiplierOnehundredButton.addEventListener('click', function(e) {
    toggleMultiplier(1000);
  });


  function toggleMultiplier(amount = 1){
    //console.log(amount)
    stepMultiplier = amount;
    switch (amount){
      case 10:
        multiplierOneButton.classList.add("act");
        multiplierTenButton.classList.remove("act");
        multiplierOnehundredButton.classList.remove("act");
        stepMultiplier = amount;
        break;

      case 100:
        multiplierOneButton.classList.remove("act");
        multiplierTenButton.classList.add("act");
        multiplierOnehundredButton.classList.remove("act");
        break;

      case 1000:
        multiplierOneButton.classList.remove("act");
        multiplierTenButton.classList.remove("act");
        multiplierOnehundredButton.classList.add("act");
        break;

      default:
        multiplierOneButton.classList.add("act");
        multiplierTenButton.classList.remove("act");
        multiplierOnehundredButton.classList.remove("act");
        break;
    }
}

socket.on('progressDraw', function (data) {
    console.log(data);
    var cmdCode = data.cmd
    var x = data.x
    var y = data.y
    var tox0 = data.x0
    var toy0 = data.y0
    var tox1 = data.x1
    var toy1 = data.y1
    var tox2 = data.x2
    var toy2 = data.y2
    var pen = data.pen
    var progcanvas = document.getElementById("progress");
    var progctx = progcanvas.getContext("2d");

    var penButton = document.getElementById("button_pen");

    crossHair(x,y,pen);

    switch (pen) {
        case 0:
            // pen is down
            penButton.classList.remove('up')
            penButton.classList.add('down')
        break

        case 1:
            // pen is up
            penButton.classList.remove('down')
            penButton.classList.add('up')
        break
    }
 
    switch (cmdCode) {
        case 'L':
            progctx.beginPath();
            progctx.lineWith = "1";
            progctx.strokeStyle = "#FF0000"
            progctx.moveTo(x, y);
            progctx.lineTo(tox0, toy0);
            progctx.stroke();
        break
        case 'V':
            progctx.beginPath();
            progctx.lineWith = "1";
            progctx.strokeStyle = "#FF0000"
            progctx.moveTo(x, y);
            progctx.lineTo(tox0, toy0);
            progctx.stroke();
        break
        case 'C':
            progctx.beginPath();
            progctx.lineWith = "1";
            progctx.strokeStyle = "#FF0000"
            progctx.moveTo(x, y);
            
            progctx.bezierCurveTo(tox1, toy1, tox2, toy2, tox0, toy0);
            progctx.stroke();
        break

        default:
        progctx.fillStyle = "#FF0000";
        progctx.fillRect(x, y, 1, 1);
        progctx.stroke(); 
    }
    


});

var dfield = document.querySelector('input[id="input-d"]');
var xfield = document.querySelector('input[id="input-x"]');
var yfield = document.querySelector('input[id="input-y"]');
var drawingScale = document.querySelector('input[id="input-s"]');

dfield.onchange = function (e) {
    if (dfield.value == "") dfield.value = 0
    var data = {
        d: Number(dfield.value),
    }
    socket.emit('setD', data)
    console.log('setD:' + dfield.value)
}

drawingScale.onchange = function (e) {
    if (drawingScale.value == "") drawingScale.value = 100
    var data = {
        drawingScale: Number(drawingScale.value),
    }
    console.log(data);
    socket.emit('drawingScale', data);
}

function updateStartPos() {
    var data = {
        x: Number(xfield.value),
        y: Number(yfield.value)
    }
    socket.emit('setStartPos', data)
}
xfield.onchange = yfield.onchange = updateStartPos;

socket.on('DXY', function (data) {
    console.log('DXY', data)
    dfield.value = data.d
    xfield.value = data.x
    yfield.value = data.y
    drawingScale.value = data.s
});

socket.on('botConnect', function (data) {
    botConnectHandler()
})
socket.on('botDisconnect', function (data) {
    botDisconnectHandler()
})
socket.on('botConnectionStatus', function (connected) {

    if (connected) {
        botConnectHandler()
    } else {
        botDisconnectHandler()
    }
})

function botConnectHandler() {
    //rebootButton.classList.remove('fa-spin')
    connectionIndicator.classList.remove('disconnected')
    connectionIndicator.classList.remove('rebooting')
    connectionIndicator.classList.add('connected')
}
function botDisconnectHandler() {
    connectionIndicator.classList.remove('rebooting')
    connectionIndicator.classList.remove('connected')
    connectionIndicator.classList.add('disconnected')
}

//ar closeButton = document.querySelector('.close');
//closeButton.addEventListener('click', function (e) {
//    toggleSettings();
//});

var pauseButton = document.querySelector('#button_arrow_pause');
pauseButton.addEventListener('click', function (e) {
    data = 0;
    socket.emit('pause', data);
});

/*var rebootButton = document.querySelector('.reboot');
rebootButton.addEventListener('click', function (e) {
    socket.emit('reboot')
    connectionIndicator.classList.remove('connected')
    connectionIndicator.classList.remove('disconnected')
    connectionIndicator.classList.add('rebooting')
    rebootButton.classList.add('fa-spin')
});*/



// drag and drop
function ParseXML(val) {
    if (window.DOMParser) {
        parser = new DOMParser();
        xmlDoc = parser.parseFromString(val, "text/xml");
    }
    return xmlDoc;
}

let dropTarget = document.querySelector('#view_move');
dropTarget.ondragover = function () {
    this.classList.add('dragover');
    console.log("dragover");
    return false;
}
dropTarget.ondragend = function () {
    this.classList.remove('dragover');
    console.log("dragend");
    return false;
}
dropTarget.ondrop = function (e) {
    this.classList.remove('dragover');
    e.preventDefault();

    console.log('dropped!');
    var file = e.dataTransfer.files[0];
    console.log(file);

    setPreviewUrl(URL.createObjectURL(file));

    var reader = new FileReader();
    reader.onload = ({ target: { result: content } }) => socket.emit('drawart', { content });
    reader.readAsText(file);

    return false;
}

function setPreviewUrl(url) {
    progressButton.click();

    const progress = document.getElementById('progress');
    progress.getContext('2d').clearRect(0, 0, progress.width, progress.height);

    const crosshair = document.getElementById('crosshair');
    crosshair.getContext('2d').clearRect(0, 0, crosshair.width, crosshair.height);

    const preview = document.getElementById('preview');

    preview.src = url;
    preview.addEventListener('load', () => {
        const { naturalWidth: width, naturalHeight: height } = preview;
        progress.width = crosshair.width = width;
        progress.height = crosshair.height = height;    
    }, { once: true });
}

readFile = function(filename){
    const svgPath = `/files/${filename}`;
    setPreviewUrl(svgPath);
    fetch(svgPath).then(res => res.text()).then(content => socket.emit('drawart', { content }));
}
