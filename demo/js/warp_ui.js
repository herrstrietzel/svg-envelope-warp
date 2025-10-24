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
