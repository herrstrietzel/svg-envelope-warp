/**
 * get SVG
 */


window.addEventListener("DOMContentLoaded", (e) => {
    // get all inputs settings
    let settings = enhanceInputsSettings;
    //console.log("settings", settings);

    updateSvg(settings);

    // listen to updates
    document.addEventListener("settingsChange", () => {
        //console.log("settings update:", settings);
        updateSvg(settings);
    });


    // load samples
    envelopeSamples.addEventListener('input', e => {
        inputEnvelope.value = envelopeSamples.value;
        inputEnvelope.dispatchEvent(new Event('input'))
    })



});




//  target elements
let svg = document.getElementById("svgWarp");
let hullPoly = document.getElementById("hullPoly");
let hullPolyNorm = document.getElementById("hullPolyNorm");
let gHandles = document.getElementById("gHandles");
let warp = null;
let controlPoints = []



function updateSvg(settings) {

    // get svg input
    let { envelope, svgIn, fitToHull, resetHull,autoViewBox, hullPadding } = settings;

    let svgDom = new DOMParser().parseFromString(svgIn, 'text/html').querySelector('svg');
    let children = [...svgDom.children];


    // reset previous
    svg.innerHTML = ''

    children.forEach(child => {
        svg.append(child)
    })


    /**
     * adjust viewBox 
     * for app
     */

    let bb = svg.getBBox();
    // viewBox from input
    let hasViewBox = svgDom.getAttribute('viewBox');

    // center elements according to x/y min
    if(autoViewBox){
        bb.width=bb.x*2+bb.width;
        bb.height=bb.y*2+bb.height;
    }

    let viewBox = hasViewBox && !autoViewBox ? svgDom.viewBox.baseVal : bb;
    let { x, y, width, height } = viewBox;

    if (!hasViewBox) {
        width += x * 2
        height += y * 2
    }

    // adjust viewBox
    let vB = [0, 0, width, height].map(val => +val.toFixed(0));
    svg.setAttribute('viewBox', vB.join(' '));
    //console.log('viewBox', viewBox);


    /**
     * init warp.js
     */
    // init warp.js with SVG path
    warp = new Warp(svg);


    let envelopeWarp = warp.envelope(envelope, settings)
    //let svgW = envelopeWarp.getSVG()
    svgOut.value = envelopeWarp.getSVG()
    //let pathData = envelopeWarp.getPathData()
    svgPathOut.value = envelopeWarp.getPathData()

    let rect = envelopeWarp.getRect()
    vB = envelopeWarp.getViewBox();


    // update viewBox
    svgControl.setAttribute('viewBox', vB.join(' '));


    // update control points
    controlPoints = envelopeWarp.getPoly()


    // display rect
    hullPolyNorm.setAttribute('points', stringifyToPointAtt(rect))

    
    // initial envelope render
    drawControlShape(hullPoly, controlPoints)

    // add envelope control handles
    addControlHandles(controlPoints, gHandles);


    window.addEventListener('warpEnd', (e) => {

        let vb = envelopeWarp.getViewBox()
        console.log(vb);

        svgOut.value = envelopeWarp.getSVG()
        svgPathOut.value = envelopeWarp.getPathData()
    })

}







/**
 * UI
 */

// Function to draw the control shape
function drawControlShape(hullPoly, controlPoints) {
    hullPoly.setAttribute('points', stringifyToPointAtt(controlPoints))
}

function addControlHandles(controlPoints, gControlhandles) {

    // reset previous handles
    gControlhandles.innerHTML = '';

    // Add code to draw handles at each control point
    for (let i = 0; i < controlPoints.length; i++) {
        let pt = controlPoints[i]
        let handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        handle.setAttribute("cx", pt.x);
        handle.setAttribute("cy", pt.y);
        handle.setAttribute("r", '2%');
        handle.setAttribute("fill", "red");
        handle.classList.add('vertice-handle')
        gControlhandles.append(handle);
    }

    // Add event listeners for mouse interactions on each handle
    let handles = gControlhandles.querySelectorAll(".vertice-handle");
    initEnvelopeEditing(handles);

}


function initEnvelopeEditing(handles) {
    handles.forEach((handle) => {
        handle.addEventListener("mousedown", startDrag);
    });
}


// Function to initiate dragging
function startDrag(event) {

    // Store the current dot and its initial position
    let activeDot = event.target;
    let initialX = event.clientX;
    let initialY = event.clientY;
    let offsetX = parseInt(activeDot.getAttribute("cx"));
    let offsetY = parseInt(activeDot.getAttribute("cy"));


    let handles = document.querySelectorAll('.vertice-handle');

    // Get the index of the active dot in the handles NodeList
    let index = [...handles].indexOf(activeDot);

    // Add event listeners for mouse move and mouse up events
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", endDrag);

    // Function to handle dragging
    function drag(event) {

        // Calculate the distance moved by the mouse
        let deltaX = event.clientX - initialX;
        let deltaY = event.clientY - initialY;

        // Update the position of the dot based on the mouse movement
        let newX = offsetX + deltaX;
        let newY = offsetY + deltaY;
        activeDot.setAttribute("cx", newX);
        activeDot.setAttribute("cy", newY);

        // Update the controlPoints array with the new positions
        controlPoints[index] = { x: newX, y: newY };

        // Redraw the control shape
        drawControlShape(hullPoly, controlPoints);

        // Update the warp transformation based on the new control points
        warp.transform((v0) => applyWarp(v0, controlPoints));

    }

    // Function to end dragging
    function endDrag() {
        // Remove the event listeners for mouse move and mouse up events
        document.removeEventListener("mousemove", drag);
        document.removeEventListener("mouseup", endDrag);

        // show new markup
        window.dispatchEvent(new Event('warpEnd'))

    }
}



