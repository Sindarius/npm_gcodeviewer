/*eslint-disable*/
'use strict';

import * as d3 from 'd3';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture'

function getNumber(tokenNumber, value, relativeMove) {
    let number = Number(tokenNumber.substring(1));
    number = !number ? 0 : number;
    return relativeMove ? number + value : number;
}

export function doArc(tokens, currentPosition, relativeMove, arcSegLength, fixRadius) {

    const currX = currentPosition.x,
        currY = currentPosition.z, //BabylonJS Z represents depth so Y and Z are switched
        currZ = currentPosition.y;

    let x = currX,
        y = currY,
        z = currZ,
        i = 0,
        j = 0,
        r = 0;
    var cw = tokens.some(t => t.includes('G2'));
    //read params
    for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
        const token = tokens[tokenIdx];
        switch (token[0]) {
            case 'X': {
                x = getNumber(token, x, relativeMove);
            } break;
            case 'Y': {
                y = getNumber(token, y, relativeMove);
            } break;
            case 'Z': {
                z = getNumber(token, z, relativeMove);
            } break;
            case 'I': {
                i = getNumber(token, i, false);
            } break; // x offset from current position
            case 'J': {
                j = getNumber(token, j, false);
            } break; //y offset from current position
            case 'R': {
                r = getNumber(token, r, false);
            } break;
        }
    }

    //If we have an R param we need to find th radial point (we'll use 1mm segments for now)
    //Given R it is possible to have 2 values .  Positive we use the shorter of the two.
    if (r) {
        const deltaX = x - currX;
        const deltaY = y - currY;

        const dSquared = Math.pow(deltaX, 2) + Math.pow(deltaY, 2);
        if (dSquared === 0) {
            return { position: { x: x, y: z, z: y }, points: [] }; //we'll abort the render and move te position to the new position.
        }

        let hSquared = Math.pow(r, 2) - dSquared / 4;
        let hDivD = 0

        if (hSquared >= 0) {
            hDivD = Math.sqrt(hSquared / dSquared);    
        }
        else {
            if (hSquared < -0.02 * Math.pow(r, 2)) {
                if (fixRadius) {
                    const minR = Math.sqrt(Math.pow(deltaX / 2, 2) + Math.pow(deltaY / 2, 2));
                    hSquared = Math.pow(minR, 2) - dSquared / 4;
                    hDivD = Math.sqrt(hSquared / dSquared);    
                }
                else {
                    console.error("G2/G3: Radius too small")
                    return { position: { x: x, y: z, z: y }, points: [] }; //we'll abort the render and move te position to the new position.
                }
            }
        }
        
        // Ref RRF DoArcMove for details
        if ((cw && r < 0.0) || (!cw && r > 0.0)) {
            hDivD = -hDivD;
        }
        i = deltaX / 2 + deltaY * hDivD;
        j = deltaY / 2 - deltaX * hDivD;
    } else {
        //the radial point is an offset from the current position
        ///Need at least on point 
        if (i === 0 && j === 0) {
            return { position: { x: x, y: y, z: z }, points: [] }; //we'll abort the render and move te position to the new position.
        }
    }

    const wholeCircle = currX === x && currY === y;
    const centerX = currX + i;
    const centerY = currY + j;

    const arcRadius = Math.sqrt(i * i + j * j);
    const arcCurrentAngle = Math.atan2(-j, -i);
    const finalTheta = Math.atan2(y - centerY, x - centerX);


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

    //let arcSegmentLength = this.; //hard coding this to 1mm segment for now

    let totalSegments = (arcRadius * totalArc) / arcSegLength //+ 0.8;
    if (totalSegments < 1) {
        totalSegments = 1;
    }

    let arcAngleIncrement = totalArc / totalSegments;
    arcAngleIncrement *= cw ? -1 : 1;

    const points = new Array();

    const zDist = currZ - z;
    const zStep = zDist / totalSegments;

    //get points for the arc
    let px = currX;
    let py = currY;
    let pz = currZ;
    //calculate segments
    let currentAngle = arcCurrentAngle;
    for (let moveIdx = 0; moveIdx < totalSegments - 1; moveIdx++) {
        currentAngle += arcAngleIncrement;
        px = centerX + arcRadius * Math.cos(currentAngle);
        py = centerY + arcRadius * Math.sin(currentAngle);
        pz += zStep;
        points.push({ x: px, y: pz, z: py });
    }

    points.push({ x: x, y: z, z: y });

    //position is the final position
    return { position: { x: x, y: z, z: y }, points: points }; //we'll abort the render and move te position to the new position.
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
