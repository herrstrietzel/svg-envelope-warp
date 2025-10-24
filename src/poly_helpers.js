

export function parsePointAtt(input) {

    let pts = []

    // is already point array
    let isArray = Array.isArray(input);

    // is nested array – x/y grouped in sub arrays
    let isNested = isArray && input[0].length === 2;
    //console.log('isNested', isNested, input);

    let isPointArray = isArray && typeof input[0] === 'object' && !isNested


    // native SVG polygon point lists
    let isSVGPointList = !isPointArray && typeof input === 'object' && [...input].length > 1;
    if (isSVGPointList) {
        input = [...input]
        isPointArray = input[0].constructor.name === 'SVGPoint' ? true : false
    }

    //console.log('hasConstructor', isSVGPointList, 'isPointArray', isPointArray, 'type',  input);


    if (isPointArray) return input;

    if (isNested) {

        pts = input.map((pt) => {
            return { x: pt[0], y: pt[1] };
        });

        return pts
    }


    let isString = typeof input === 'string';
    if (!isString) {
        console.warn("Couldn't parse point input", (typeof input), input)
        return pts;
    }

    // string - sanitize
    input = isString ? input.trim().replace(/[\n|\r|\t]/g, '') : input;

    let isPathData = isString && (input.startsWith('m') || input.startsWith('M'))

    // is json?
    let isJson = input.includes('[') && input.includes('{') && input.includes('x') && input.includes('y')


    if (isPathData) {
        pts = pathData2Poly(input);
        return pts;
    }

    if (isJson) {
        try {
            pts = JSON.parse(input)
            //console.log(pts);
        } catch {
            console.warn('no valid point json');
        }
    }
    // is point attribute string
    else {
        pts = input.replaceAll(',', ' ').split(' ')
            .filter(Boolean).map(Number)
        pts = toPointArray(pts)

    }

    pts = cleanUpPoly(pts)

    return pts;
}



export function stringifyToPointAtt(pts) {
    return pts.map(pt => { return [pt.x, pt.y].join(' ') }).join(' ');
}

export function toPointArray(pts) {
    let ptArr = [];
    for (let i = 1, l = pts.length; i < l; i += 2) {
        ptArr.push({ x: pts[i - 1], y: pts[i] });
    }
    return ptArr;
};


export function pathData2Poly(pathdata) {

    let pts = [];
    let isPolygon = /[csqta]/gi.test(pathdata) ? false : true
    let hasShorthands = /[vh]/gi.test(pathdata) ? true : false
    let hasRelative = (/[l]/gi.test(pathdata) || pathdata.startsWith('m')) ? true : false
    const ns = 'http://www.w3.org/2000/svg';

    // sanitize shortened minus
    pathdata = pathdata.replaceAll('-', ' -')

    // strip M and L
    if (isPolygon && !hasRelative && !hasShorthands) {
        pathdata = pathdata.replace(/[M|L]/g, ' ')
        let ptsArr = pathdata.replaceAll(',', ' ').split(' ')
            .filter(Boolean).map(Number)

        for (let i = 1, l = ptsArr.length; i < l; i += 2) {
            pts.push({ x: ptsArr[i - 1], y: ptsArr[i] });
        }

    }
    // create temporary path to parse
    else {

        let svgTmp = document.createElementNS(ns, 'svg');
        let path = document.createElementNS(ns, 'path');
        path.setAttribute('d', pathdata);
        svgTmp.append(path)

        let warp = new Warp(svgTmp)
        let threshold = isPolygon ? Infinity : 3;
        warp.interpolate(threshold);

        let pathDataArr = warp.paths;
        pathDataArr.forEach(path => {
            let pathData = path.pathData;
            let commands = pathData.map(com => { return { x: com.x, y: com.y } })
            pts.push(...commands)
        })
    }

    // remove coinciding points
    /*
    if(pts[0].x === pts[pts.length-1].x && pts[0].y === pts[pts.length-1].y){
        pts.pop()
        console.log('remove');
    }
    */

    //console.log('pts hull', pts, remove);

    return cleanUpPoly(pts)
}

export function cleanUpPoly(pts) {

    let remove = []
    pts.forEach((pt, i) => {
        let indexPrev = i > 0 ? i - 1 : pts.length - 1
        let pt0 = pts[indexPrev]
        if (pt.x === pt0.x && pt0.y === pt.y) {
            remove.push(indexPrev)
        }
    })

    remove.forEach(r => {
        pts.splice(r, 1)
    })

    return pts

}




export function normalizePoly(pts, width = 100, height = 100, fitToHull = false, autoViewBox = false, bbSVG = { x: 0, y: 0, width: 0, height: 0 }, padding = 0) {
    if (!pts || pts.length < 3) return pts;


    // Clone
    let ptsCopy = JSON.parse(JSON.stringify(pts));
    //console.log('bbSVG', bbSVG, width, height);


    if (fitToHull && bbSVG.width) {
        width = bbSVG.width;
        height = bbSVG.height;
    }


    // Compute envelope bounding box 
    let bb = getPolyBBox(pts);
    let scaleX = width / (bb.width);
    let scaleY = height / (bb.height);

    let translateX = bb.x;
    let translateY = bb.y;

    if (fitToHull) {
        // uniform scaling – keep aspect ratio
        let scale = Math.max(scaleX, scaleY);
        scaleX = scaleY = scale;
    }



    // change starting point and drawing direction
    let area = getPolygonArea(ptsCopy, false);
    let isCW = area > 0 ? true : false;
    if (!isCW) ptsCopy = ptsCopy.reverse();

    ptsCopy = sortPolygonTopLeftFirst(ptsCopy, bb)


    // Move to origin and scale
    ptsCopy = ptsCopy.map(pt => ({
        x: (pt.x - translateX) * scaleX,
        y: (pt.y - translateY) * scaleY
    }));

    // Recompute bounding box after scaling
    let scaledBB = getPolyBBox(ptsCopy);


    // Center polygon within target viewBox
    let offsetX = (width - scaledBB.width) / 2 - scaledBB.x;
    let offsetY = (height - scaledBB.height) / 2 - scaledBB.y;


    if (fitToHull && bbSVG.width) {
        offsetX += bbSVG.x
        offsetY += bbSVG.y
    }

    if (fitToHull && autoViewBox) {
        offsetX -= bbSVG.x
        offsetY -= bbSVG.y
        bbSVG.x = 0
        bbSVG.y = 0
    }

    ptsCopy = ptsCopy.map(pt => ({
        x: pt.x + offsetX,
        y: pt.y + offsetY
    }));

    // get rectangular projection if needed
    scaledBB = getPolyBBox(ptsCopy);


    // add padding to rectangular hull
    if (padding) {
        bbSVG.x -= padding
        bbSVG.y -= padding
        bbSVG.width += padding * 2
        bbSVG.height += padding * 2
    }


    let polyRect = fitToHull && bbSVG.width ? getRectangularPoly(ptsCopy, bbSVG) : getRectangularPoly(ptsCopy, scaledBB);



    // add mid point for mesh test
    /*
    let bb_rect = getPolyBBox(polyRect);
    let ptC = {x:bb_rect.x+bb_rect.width*0.5, y:bb_rect.y+bb_rect.height*0.5}
    polyRect.push(ptC)
    */
    //return { bb: scaledBB, rect: ptsCopy, poly: ptsCopy };


    //let d = 'M '+ptsCopy.map(com=>{return `${com.x} ${com.y}`}).join(' ')
    //console.log(d, ptsCopy);

    return { bb: scaledBB, rect: polyRect, poly: ptsCopy };
    
}



export function getRectangularPoly(pts, bb) {
    if (!pts || pts.length < 4) return [];

    const n = pts.length;
    const landscape = bb.width >= bb.height;

    // base count per side
    const base = Math.floor(n / 4);
    let rem = n - base * 4;

    // corner points
    const TL = { x: bb.x, y: bb.y };
    const TR = { x: bb.x + bb.width, y: bb.y };
    const BR = { x: bb.x + bb.width, y: bb.y + bb.height };
    const BL = { x: bb.x, y: bb.y + bb.height };

    // distribute remaining vertices
    let topN = base;
    let rightN = base;
    let bottomN = base;
    let leftN = base;

    if (landscape) {
        bottomN += rem; // landscape: stretch bottom edge
    } else {
        rightN += rem; // portrait: stretch right edge
    }

    const rectPts = [];

    // helper to interpolate evenly along an edge (exclude last corner)
    const edge = (from, to, count) => {
        const pts = [];
        for (let i = 0; i < count; i++) {
            const t = i / count;
            pts.push({
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t,
            });
        }
        return pts;
    };

    // Build clockwise: top, right, bottom, left
    rectPts.push(...edge(TL, TR, topN));
    rectPts.push(...edge(TR, BR, rightN));
    rectPts.push(...edge(BR, BL, bottomN));
    rectPts.push(...edge(BL, TL, leftN));

    // Adjust vertex count in case of rounding
    if (rectPts.length > n) rectPts.length = n;

    return rectPts;
}



export function getPolygonArea(pts, absolute = true) {
    let area = 0;
    for (let i = 0, len = pts.length; len && i < len; i++) {
        let ptN = pts[i === len - 1 ? 0 : i + 1];
        let addX = pts[i].x;
        let addY = ptN.y;
        let subX = ptN.x;
        let subY = pts[i].y;
        area += addX * addY * 0.5 - subX * subY * 0.5;
    }
    return absolute ? Math.abs(area) : area;
}


export function getPolyBBox(vertices) {
    let xArr = vertices.map(pt => pt.x);
    let yArr = vertices.map(pt => pt.y);
    let left = Math.min(...xArr)
    let right = Math.max(...xArr)
    let top = Math.min(...yArr)
    let bottom = Math.max(...yArr)
    let bb = {
        x: left,
        left: left,
        right: right,
        y: top,
        top: top,
        bottom: bottom,
        width: right - left,
        height: bottom - top
    };

    return bb;
}



export function getCabDistance(pt1, pt2) {
    let dx = Math.abs(pt1.x - pt2.x)
    let dy = Math.abs(pt1.y - pt2.y)
    return dx + dy;
}


export function getSquareDistance(p1, p2) {
    return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
}


export function sortPolygonTopLeftFirst(pts, bb) {
    if (!pts || pts.length === 0) return pts;

    if (!bb) bb = getPolyBBox(pts);
    let ptCorner = { x: bb.left, y: bb.top };

    let firstIndex = 0;
    let minDist = Infinity;


    for (let i = 0; i < pts.length; i++) {
        let dist = getSquareDistance(pts[i], ptCorner);
        if (dist < minDist) {
            minDist = dist;
            firstIndex = i;
        }
    }

    return pts.slice(firstIndex).concat(pts.slice(0, firstIndex));
}




