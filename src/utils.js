/*eslint-disable*/
'use strict';

import * as d3 from 'd3';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

function getNumber(tokenNumber, value, relativeMove, offset) {
    let number = Number(tokenNumber.substring(1));
    number = !number ? 0 : number;
    return relativeMove ? number + value : number + offset;
}

export function doArc(tokens, currentPosition, relativeMove, arcSegLength, fixRadius, arcPlane, offset) {
    
    let current = new Vector3(currentPosition.x, currentPosition.z, currentPosition.y);
    let move = current.clone();

    let i = 0,
        j = 0,
        r = 0;
    var cw = tokens.some(t => t.includes('G2'));
    //read params
    for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
        const token = tokens[tokenIdx];
        switch (token[0]) {
            case 'X': {
                move.x = getNumber(token, move.x, relativeMove, offset.x);
            } break;
            case 'Y': {
                move.y = getNumber(token, move.y, relativeMove,  offset.y);
            } break;
            case 'Z': {
                move.z = getNumber(token, move.z, relativeMove, offset.z);
            } break;
            case 'I': {
                i = getNumber(token, i, false, 0);
            } break; // x offset from current position
            case 'J': {
                j = getNumber(token, j, false, 0);
            } break; //y offset from current position
            case 'K': { 
                j = getNumber(token, j, false, 0);
            } break;
            case 'R': {
                r = getNumber(token, r, false, 0);
            } break;
        }
    }

    let axis0 = 'x';
    let axis1 = 'y';
    let axis2 = 'z';
    switch (arcPlane) { 
        case 'XY': { 
            axis0 = 'x';
            axis1 = 'y';
            axis2 = 'z';
        } break;
        case 'XZ': { 
            axis0 = 'z'; //Have to invert for correct arc direction per RRF
            axis1 = 'x';
            axis2 = 'y';
            let temp = j; //swap i and j
            j = i;
            i = temp;
        } break;
        case 'YZ': {
            axis0 = 'y';
            axis1 = 'z';
            axis2 = 'x';
        } break;
    }

    //If we have an R param we need to find th radial point (we'll use 1mm segments for now)
    //Given R it is possible to have 2 values .  Positive we use the shorter of the two.
    if (r) {
        const delta0 = move[axis0] - current[axis0];
        const delta1 =  move[axis1] - current[axis1];

        const dSquared = Math.pow(delta0, 2) + Math.pow(delta1, 2);
        if (dSquared === 0) {
            return { position: current.clone(), points: [] }; //we'll abort the render and move te position to the new position.
        }

        let hSquared = Math.pow(r, 2) - dSquared / 4;
        let hDivD = 0

        if (hSquared >= 0) {
            hDivD = Math.sqrt(hSquared / dSquared);    
        }
        else {
            if (hSquared < -0.02 * Math.pow(r, 2)) {
                if (fixRadius) {
                    const minR = Math.sqrt(Math.pow(delta0 / 2, 2) + Math.pow(delta1 / 2, 2));
                    hSquared = Math.pow(minR, 2) - dSquared / 4;
                    hDivD = Math.sqrt(hSquared / dSquared);    
                }
                else {
                    console.error("G2/G3: Radius too small")
                    return { position:  { x: move.x, y: move.z, z: move.y }, points: [] }; //we'll abort the render and move te position to the new position.
                }
            }
        }
        
        // Ref RRF DoArcMove for details
        if ((cw && r < 0.0) || (!cw && r > 0.0)) {
            hDivD = -hDivD;
        }
        i = delta0 / 2 + delta1 * hDivD;
        j = delta1 / 2 - delta0 * hDivD;
    } else {
        //the radial point is an offset from the current position
        ///Need at least on point 
        if (i === 0 && j === 0) {
            return { position: current.clone(), points: [] }; //we'll abort the render and move te position to the new position.
        }
    }

    const wholeCircle = current[axis0] === move[axis0] && current[axis1] === move[axis1];
    const center0 = current[axis0] + i;
    const center1 = current[axis1] + j;

    const arcRadius = Math.sqrt(i * i + j * j);
    const arcCurrentAngle = Math.atan2(-j, -i);
    const finalTheta = Math.atan2(move[axis1] - center1, move[axis0] - center0);


    let totalArc;
    if (wholeCircle) {
        totalArc = 2 * Math.PI;
    }
    else {
        totalArc = cw ? arcCurrentAngle - finalTheta : finalTheta - arcCurrentAngle;
        if (totalArc < 0.0) {
            totalArc += 2 * Math.PI;
        }
    }

    let totalSegments = (arcRadius * totalArc) / arcSegLength
    if (totalSegments < 1) {
        totalSegments = 1;
    }

    let arcAngleIncrement = totalArc / totalSegments;
    arcAngleIncrement *= cw ? -1 : 1;

    const points = new Array();

    const axis2Dist = current[axis2] - move[axis2];
    const axis2Step = axis2Dist / totalSegments;


    //get points for the arc
    let p0 = current[axis0];
    let p1 = current[axis1];
    let p2 = current[axis2];
    //calculate segments
    let currentAngle = arcCurrentAngle;
    for (let moveIdx = 0; moveIdx < totalSegments - 1; moveIdx++) {
        currentAngle += arcAngleIncrement;
        p0 = center0 + arcRadius * Math.cos(currentAngle);
        p1 = center1 + arcRadius * Math.sin(currentAngle);
        p2 += axis2Step;
        let output = {};
        output[axis0] = p0;
        output[axis1] = p1;
        output[axis2] = p2;
        points.push({ x: output['x'], y: output['z'], z: output['y']}); //use output to get the correct axes setup for output
    }

    points.push({ x: move.x, y: move.z, z: move.y });

    //position is the final position
    return { position:  { x: move.x, y: move.z, z: move.y }, points: points }; //we'll abort the render and move te position to the new position.
}

export function pauseProcessing() {
    return new Promise((resolve) => setTimeout(resolve)).then(() => {
      return Date.now();
    });
  }


export function makeTextPlane(scene, text, color, bgColor, width, height, fontSize = 75) {
    var svg = d3
      .create('svg')
      .attr('width', 400)
      .attr('height', 300)

    svg.append('rect')
    .attr('x',0)
    .attr('y',0)
    .attr('width', 400 )
    .attr('height', 300)
    .attr('fill', '#333333')

    svg
      .append('text')
      .attr('x', 200)
      .attr('y', 150)
      .attr('font-family', 'Roboto')
      .attr('font-size', fontSize + 'px')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('fill', bgColor)
      .attr('stroke', color)
      .attr('stroke-width', 2)
      .attr('text-rendering', 'optimizeLegibility')
      .text(text);

    var html = svg
      .attr('title', 'test2')
      .attr('version', 1.1)
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .node(); //.parentNode.innerHTML;

    var doctype = '<?xml version="1.0" standalone="no"?>' + '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';

    var source = new XMLSerializer().serializeToString(html);
    var blob = new Blob([doctype + source], { type: 'image/svg+xml' });
    var url = window.URL.createObjectURL(blob);

    const plane = MeshBuilder.CreatePlane('TextPlane', { width, height}, scene);
    plane.material = new StandardMaterial('TextPlaneMaterial', scene);
    plane.material.backFaceCulling = false;
    plane.material.specularColor = new Color3(0,0,0);
    plane.material.diffuseTexture = new Texture(url, scene); //dynamicTexture;
    plane.material.diffuseTexture.hasAlpha = false;
    return plane;
  }
