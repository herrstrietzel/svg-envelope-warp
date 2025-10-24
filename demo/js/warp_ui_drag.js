
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


