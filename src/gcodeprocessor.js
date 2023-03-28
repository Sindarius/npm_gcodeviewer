'use strict';

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4, Color3 } from '@babylonjs/core/Maths/math.color';
import { PointsCloudSystem } from '@babylonjs/core/Particles/pointsCloudSystem';
import { pauseProcessing, doArc } from './utils.js';
import gcodeLine from './gcodeline';
import Tool, { ToolType } from './tool';

import BlockRenderer from './RenderModes/block';
import CylinderRenderer from './RenderModes/cylinder';
import VoxelRenderer from './RenderModes/voxel';
import LineRenderer from './RenderModes/line';

import SlicerFactory from './SlicerSpecific/slicerfactory';

export const RenderMode = {
   Block: 1,
   Line: 2,
   Point: 3,
   Max: 4,
   Voxel: 5
};

export const ColorMode = {
   Color: 0,
   Feed: 1,
   Feature: 2
};

export default class {
   constructor() {
      this.currentPosition = new Vector3(0, 0, 0);
      this.currentColor = new Color4(0.25, 0.25, 0.25, 1);
      this.currentTool = 0;
      this.renderVersion = RenderMode.Line;
      this.absolute = true; //Track if we are in relative or absolute mode.
      this.lines = [];
      this.renderedLines = []; //Lines that have been rendered - we'll use this to get the current file position etc.
      this.currentLineNumber = 0; //Index of current rendered line
      this.lastFilePositionIndex = 0;

      this.travels = [];
      this.sps;
      this.maxHeight = 0;
      this.minHeight = 0;
      this.lineCount = 0;
      this.renderMode = '';
      this.extruderCount = 10;
      this.layerDictionary = [];

      //We'll look at the last 2 layer heights for now to determine layer height.
      this.previousLayerHeight = 0;
      this.currentLayerHeight = 0;

      //Live Rendering
      this.liveTracking = false; //Tracks if we loaded the current job to enable live rendering
      this.liveTrackingShowSolid = localStorage.getItem('showSolid') === 'true'; //Flag if we want to continue showing the whole model while rendering

      this.materialTransparency = 0.3;
      this.gcodeLineIndex = [];
      this.gcodeFilePosition = 0;

      this.refreshTime = 200;
      this.timeStamp = 0;

      this.lineLengthTolerance = 0.05;

      this.tools = new Array();
      let cmyk = ['#00FFFF', '#FF00FF', '#FFFF00', '#000000', '#FFFFFF'];
      //Create a default set of tools
      for (let idx = 0; idx < 5; idx++) {
         let tool = new Tool();
         tool.color = Color4.FromHexString(cmyk[idx]);
         tool.diameter = 0.4;
         this.tools.push(tool);
      }

      this.progressColor = new Color4(0, 1, 0, 1);
      this.keepProgressColor = false;

      //scene data
      this.lineMeshIndex = 0;
      this.scene = null;
      this.renderFuncs = new Array();

      //Mesh Breaking
      this.meshBreakPoint = 20000;

      //average feed rate trimming
      this.feedRateTrimming = false;
      this.currentFeedRate = 0;
      this.feedValues = 0;
      this.numChanges = 0;
      this.avgFeed = 0;
      this.maxFeedRate = 0;
      this.minFeedRate = Number.MAX_VALUE;
      this.underspeedPercent = 1;

      this.colorMode = Number.parseInt(localStorage.getItem('processorColorMode'), 10);
      if (!this.colorMode) {
         this.setColorMode(ColorMode.Color);
      }

      this.minColorRate = Number.parseInt(localStorage.getItem('minColorRate'), 10);
      if (!this.minColorRate) {
         this.minColorRate = 1200;
         localStorage.setItem('minColorRate', this.minColorRate);
      }

      this.maxColorRate = Number.parseInt(localStorage.getItem('maxColorRate'), 10);
      if (!this.maxColorRate) {
         this.maxColorRate = 3600;
         localStorage.setItem('maxColorRate', this.maxColorRate);
      }

      this.minFeedColorString = localStorage.getItem('minFeedColor');
      if (!this.minFeedColorString) {
         this.minFeedColorString = '#0000FF';
      }
      this.minFeedColor = Color4.FromHexString(this.minFeedColorString.padEnd(9, 'F'));

      this.maxFeedColorString = localStorage.getItem('maxFeedColor');
      if (!this.maxFeedColorString) {
         this.maxFeedColorString = '#FF0000';
      }
      this.maxFeedColor = Color4.FromHexString(this.maxFeedColorString.padEnd(9, 'F'));

      //render every nth row
      this.everyNthRow = 0;
      this.currentRowIdx = -1;
      this.currentZ = 0;
      this.renderTravels = true;
      this.vertexAlpha = false;

      this.forceWireMode = localStorage.getItem('forceWireMode') === 'true';

      this.spreadLines = false;
      this.spreadLineAmount = 10;
      this.debug = false;
      this.specularColor = new Color3(0, 0, 0);

      this.lookAheadLength = 500;
      this.cancelLoad = false;

      this.loadingProgressCallback = () => {};

      this.hasSpindle = false;

      this.voxelWidth = 1;
      this.voxelHeight = 1;
      this.forceVoxels = false;

      this.renderInstances = new Array();
      this.meshIndex = 0;

      this.highQualityExtrusion = false;
      this.perimeterOnly = false;

      this.lastUpdate = Date.now();
      this.g1AsExtrusion = false;

      this.firstGCodeByte = 0;
      this.lastGCodeByte = 0;

      // Work in progress
      this.zBelt = false;
      this.gantryAngle = ((90 - 45) * Math.PI) / 180;
      this.hyp = Math.cos(this.gantryAngle);
      this.adj = Math.tan(this.gantryAngle);
      this.currentZ = 0;
      this.beltLength = 100;

      this.nozzlePosition = new Vector3(0, 0, 0);
      this.firmwareRetraction = false;
      this.inches = false;
      this.fixRadius = false;

      this.csysContainers = new Array();

      this.lastCommand = 'G0';
      this.arcPlane = 'XY';

      //Workplace coordinates
      this.workplaceOffsets = [new Vector3(0, 0,0), new Vector3(0, 0, 0)];
      this.currentWorkplace = 0; //internally we'll start at 0, but the user will see 1
   }

   doUpdate() {
      this.lastUpdate = Date.now();
   }

   setProgressColor(color) {
      this.progressColor = Color4.FromHexString(color.padEnd(9, 'F'));
      this.renderInstances.forEach((r) => (r.progressColor = this.progressColor));
   }

   getMaxHeight() {
      return this.maxHeight + 1;
   }

   getMinHeight() {
      return this.minHeight;
   }

   setRenderQualitySettings(numberOfLines, renderQuality) {
      if (this.forceVoxels) {
         this.renderVersion = RenderMode.Voxel;
         this.meshBreakPoint = Number.MAX_VALUE;
         return;
      }

      if (renderQuality === undefined) {
         renderQuality = 1;
      }

      let maxLines = 0;
      let renderStartIndex = this.forceWireMode ? 2 : 1;
      let maxNRow = 2;

      this.refreshTime = 5000;
      this.everyNthRow = 1;
      this.renderTravels = true;

      //Render Mode Multipliers
      // 12x - 3d
      // 2x - line
      // 1x - point

      switch (renderQuality) {
         //SBC Quality - Pi 3B+
         case 1:
            {
               renderStartIndex = 2;
               this.refreshTime = 30000;
               maxLines = 25000;
               maxNRow = 50;
               this.renderTravels = false;
            }
            break;
         //Low Quality
         case 2:
            {
               renderStartIndex = 2;
               this.refreshTime = 30000;
               maxLines = 500000;
               maxNRow = 10;
               this.renderTravels = false;
            }
            break;
         //Medium Quality
         case 3:
            {
               maxLines = 1000000;
               maxNRow = 3;
            }
            break;
         //High Quality
         case 4:
            {
               maxLines = 15000000;
               maxNRow = 2;
            }
            break;
         //Ultra
         case 5:
            {
               maxLines = 25000000;
            }
            break;
         //Max
         default: {
            this.renderVersion = RenderMode.Block;
            this.everyNthRow = 1;
            return;
         }
      }

      for (let renderModeIdx = renderStartIndex; renderModeIdx < 4; renderModeIdx++) {
         let vertextMultiplier;
         switch (renderModeIdx) {
            case 1:
               vertextMultiplier = 24;
               break;
            case 2:
               vertextMultiplier = 2;
               break;
            case 3:
               vertextMultiplier = 1;
               break;
         }

         for (let idx = this.everyNthRow; idx <= maxNRow; idx++) {
            if (this.debug) {
               console.log('Mode: ' + renderModeIdx + '  NRow: ' + idx + '   vertexcount: ' + (numberOfLines * vertextMultiplier) / idx);
            }
            if ((numberOfLines * vertextMultiplier) / idx < maxLines) {
               this.renderVersion = renderModeIdx;
               this.everyNthRow = idx;
               return;
            }
         }
      }
   }

   initVariables() {
      this.currentPosition = new Vector3(this.workplaceOffsets[this.currentWorkplace].x,this.workplaceOffsets[this.currentWorkplace].z,this.workplaceOffsets[this.currentWorkplace].y);
      this.cancelLoad = false;
      this.absolute = true;
      this.currentZ = 0;
      this.currentRowIdx = -1;
      this.gcodeLineIndex = [];
      this.lineMeshIndex = 0;
      this.previousLayerHeight = this.currentPosition.y;
      this.currentLayerHeight =  this.currentPosition.y;
      this.minFeedRate = Number.MAX_VALUE;
      this.maxFeedRate = 0;
      this.hasSpindle = false;
      this.currentColor = new Color4(1, 1, 1, 1);
      this.slicer = null;
      this.skip = false;
      this.isSupport = false;
      this.currentTool = 0;
      this.firstGCodeByte = 0;
      this.lastGCodeByte = 0;
      this.layerDictionary = [];
      this.renderedLines = [];
      this.beltLength = 0;
      this.lastCommand = 'G0';
   }

   g0g1(tokenString, lineNumber, filePosition, renderLine, command) {
      let tokens = tokenString.split(/(?=[GXYZEFUV])/);
      const line = new gcodeLine();
      let hasXYMove = false;
      line.tool = this.currentTool;
      line.gcodeLineNumber = lineNumber;
      line.gcodeFilePosition = filePosition;
      line.start = this.currentPosition.clone();


      if ((command[0] === 'G1' || command[0] === 'G01') && this.g1AsExtrusion) {
         line.extruding = true;
         line.color = this.tools[this.currentTool]?.color.clone() ?? this.tools[0].color.clone();
         this.maxHeight = this.currentPosition.y; //trying to get the max height of the model.
      }

      if (this.zBelt) {
         tokens = tokens.sort().reverse();
      }

      for (let tokenIdx = 0; tokenIdx < tokens.length; tokenIdx++) {
         let token = tokens[tokenIdx];
         switch (token[0]) {
            case 'X':
               if (this.zBelt) {
                  this.currentPosition.x = Number(token.substring(1));
               } else {
                  this.currentPosition.x = this.absolute ? Number(token.substring(1)) + this.workplaceOffsets[this.currentWorkplace].x : this.currentPosition.x + Number(token.substring(1));
               }
               hasXYMove = true;
               break;
            case 'Y':
               if (this.zBelt) {
                  this.currentPosition.y = Number(token.substring(1)) * this.hyp;
                  this.currentPosition.z = this.currentZ + this.currentPosition.y * this.adj;
               } else {
                  this.currentPosition.z = this.absolute ? Number(token.substring(1)) + this.workplaceOffsets[this.currentWorkplace].y : this.currentPosition.z + Number(token.substring(1));
               }
               hasXYMove = true;
               break;
            case 'Z':
               if (this.zBelt) {
                  this.currentZ = -Number(token.substring(1));
                  this.currentPosition.z = this.currentZ + this.currentPosition.y * this.adj;
                  hasXYMove = true;
               } else {
                  this.currentPosition.y = this.absolute ? Number(token.substring(1)) + this.workplaceOffsets[this.currentWorkplace].z : this.currentPosition.y + Number(token.substring(1));

                  if (!this.lastY || this.lastY !== this.currentPosition.y) {
                     this.lastY = this.currentPosition.y;
                     if (this.lastY === undefined) this.lastY = 0;
                  }
                  if (this.currentPosition.y < this.minHeight) {
                     this.minHeight = this.currentPosition.y;
                  }
                  if (this.spreadLines) {
                     this.currentPosition.y *= this.spreadLineAmount;
                  }
               }
               break;
            case 'E':
               //Do not count retractions as extrusions
               if (Number(token.substring(1)) > 0) {
                  line.extruding = true;
                  this.maxHeight = this.currentPosition.y; //trying to get the max height of the model.
               }
               break;
            case 'F':
               this.currentFeedRate = Number(token.substring(1));
               if (this.currentFeedRate > this.maxFeedRate) {
                  this.maxFeedRate = this.currentFeedRate;
               }
               if (this.currentFeedRate < this.minFeedRate) {
                  this.minFeedRate = this.currentFeedRate;
               }

               if (this.colorMode === ColorMode.Feed) {
                  let ratio = (this.currentFeedRate - this.minColorRate) / (this.maxColorRate - this.minColorRate);
                  if (ratio >= 1) {
                     this.currentColor = this.maxFeedColor;
                  } else if (ratio <= 0) {
                     this.currentColor = this.minFeedColor;
                  } else {
                     this.currentColor = Color4.Lerp(this.minFeedColor, this.maxFeedColor, ratio);
                  }
               }

               break;
         }
      }

      if (this.zBelt) {
         this.beltLength = this.currentPosition.z < this.beltLength ? this.currentPosition.z : this.beltLength;
      }

      if (line.extruding && this.skip) {
         return;
      }

      line.end = this.currentPosition.clone();

      if (this.debug) {
         // console.log(`${tokenString}   absolute:${this.absolute}`)
         //  console.log(lineNumber, line)
      }

      if (this.feedRateTrimming) {
         this.feedValues += this.currentFeedRate;
         this.numChanges++;
         this.avgFeed = (this.feedValues / this.numChanges) * this.underspeedPercent;
      }

      //Nth row exclusion
      if (this.everyNthRow > 1 && line.extruding) {
         if (this.currentPosition.y > this.currentZ) {
            this.currentRowIdx++;

            if (this.currentRowIdx % 3 === 0) {
               this.currentRowIdx++;
            }

            this.currentZ = this.currentPosition.y;
         }

         if (this.currentRowIdx % this.everyNthRow === 0 && this.currentRowIdx > 2) {
            return;
         }
      }

      const spindleCutting = this.hasSpindle && command[0] === 'G1';
      const lineTolerance = this.g1AsExtrusion || line.length() >= this.lineLengthTolerance;
      //feed rate trimming was disabled (probably will remove)
      // let feedRateTrimming=  this.feedRateTrimming && this.currentFeedRate < this.avgFeed;

      //Don't add the lines to to the collection for rendering purposes.
      if (!renderLine) {
         return;
      }

      this.renderedLines.push(line);

      if (spindleCutting || (lineTolerance && line.extruding)) {
         if (this.currentColor === null) {
            this.currentColor = new Color4(1, 1, 1, 1);
         }
         line.color = this.currentColor.clone();
         this.lines.push(line);

         if (this.zBelt && this.currentZ < this.currentLayerHeight && !this.isSupport) {
            this.previousLayerHeight = this.currentLayerHeight;
            this.currentLayerHeight = this.currentZ;
         } else if (!this.zBelt && this.currentPosition.y > this.currentLayerHeight && !this.isSupport && hasXYMove) {
            this.previousLayerHeight = this.currentLayerHeight;
            this.currentLayerHeight = this.currentPosition.y;
         }

         

      } else if (this.renderTravels && !line.extruding) {
         line.color = new Color4(1, 0, 0, 1);
         this.travels.push(line);
      }

            if (this.zBelt) {
         line.layerHeight = Math.abs(this.currentLayerHeight - this.previousLayerHeight);
      } else {
         line.layerHeight = this.currentLayerHeight - this.previousLayerHeight;
      }
   }

   g2g3(tokenString, lineNumber, filePosition, renderLine) {
      let tokens = tokenString.split(/(?=[GXYZIJKFRE])/);
      let extruding = tokenString.indexOf('E') > 0 || this.g1AsExtrusion; //Treat as an extrusion in cnc mode
      let cw = tokens.filter((t) => t === 'G2' || t === 'G02');
      let arcResult = { position: this.currentPosition.clone(), points: [] };
      try {
         arcResult = doArc(tokens, this.currentPosition, !this.absolute, 0.1, this.fixRadius, this.arcPlane, this.workplaceOffsets[this.currentWorkplace]);
      } catch (ex) {
         console.error(`Arc Error`, ex);
      }
      let curPt = this.currentPosition.clone();
      arcResult.points.forEach((point, idx) => {
         const line = new gcodeLine();
         line.tool = this.currentTool;
         line.gcodeLineNumber = lineNumber;
         line.gcodeFilePosition = filePosition;
         line.layerHeight = this.currentLayerHeight - this.previousLayerHeight;
         line.start = curPt.clone();
         line.end = new Vector3(point.x, point.y, point.z);
         line.color = this.currentColor.clone();
         line.extruding = extruding;
         if (this.debug) {
            line.color = cw ? new Color4(0, 1, 1, 1) : new Color4(1, 1, 0, 1);
            if (idx === 0) {
               line.color = new Color4(0, 1, 0, 1);
            }
         }
         curPt = line.end.clone();
         if (this.debug) {
            console.log(line);
         }

         if (!renderLine) {
            return;
         }

         this.renderedLines.push(line);
         this.lines.push(line);
      });

      //Last point to currentposition
      this.currentPosition = new Vector3(curPt.x, curPt.y, curPt.z);

      if (this.currentPosition.y > this.currentLayerHeight && !this.isSupport) {
         this.previousLayerHeight = this.currentLayerHeight;
         this.currentLayerHeight = this.currentPosition.y;
      }
   }

   //This is used to drive material mixing visualization
   m567(tokenString) {
      const tokens = tokenString.split(/(?=[PE])/);
      let finalColors = [1, 1, 1];
      if (this.colorMode === ColorMode.Feed) return;
      for (let tokenIdx = 1; tokenIdx < tokens.length; tokenIdx++) {
         const token = tokens[tokenIdx];
         switch (token[0]) {
            case 'E':
               this.extruderPercentage = token.substring(1).split(':');
               break;
         }
      }
      for (let extruderIdx = 0; extruderIdx < this.extruderPercentage.length; extruderIdx++) {
         finalColors[0] -= (1 - this.tools[extruderIdx].color.r) * this.extruderPercentage[extruderIdx];
         finalColors[1] -= (1 - this.tools[extruderIdx].color.g) * this.extruderPercentage[extruderIdx];
         finalColors[2] -= (1 - this.tools[extruderIdx].color.b) * this.extruderPercentage[extruderIdx];
      }
      this.currentColor = new Color4(finalColors[0], finalColors[1], finalColors[2], 0.1);
   }

   async processGcodeFile(file, renderQuality, clearCache) {
      this.initVariables();
      this.slicer = SlicerFactory.getSlicer(file);

      this.meshIndex = 0;
      this.currentTool = 0;
      if (renderQuality === undefined || renderQuality === null) {
         renderQuality = 4;
      }

      if (!file || file.length === 0) {
         return;
      }

      var lines = file.split('\n');

      //Extract metadata from slicer to set render settings
      this.slicer.processComments(lines, this);

      //Get an opportunity to free memory before we strt generating 3d model
      if (typeof clearCache === 'function') {
         clearCache();
      }

      this.lineCount = lines.length;

      if (this.debug) {
         console.info(`Line Count : ${this.lineCount}`);
      }

      this.setRenderQualitySettings(this.lineCount, renderQuality);

      if (this.tools.length === 0) {
         this.tools.push(new Tool());
      }
      //set initial color to extruder 0
      this.currentColor = this.tools[0].color ?? new Tool().color;

      lines.reverse();
      let filePosition = 0; //going to make this file position
      let lineNumber = 0; //current line number
      this.timeStamp = Date.now();

      while (lines.length) {
         if (this.cancelLoad) {
            this.cancelLoad = false;
            return;
         }
         let line = lines.pop();
         filePosition += line.length + 1; //add 1 for the removed line break
         lineNumber++;
         line.trim();

         //If perimter only check feature to see if it can be removed.
         if (!line.startsWith(';')) {
            if (this.slicer) {
               this.slicer.isTypeComment(line);
            }
            let renderLine = !this.perimeterOnly || (this.slicer && this.slicer.isPerimeter());
            if (this.firstGCodeByte === 0 && line.length > 0) {
               this.firstGCodeByte = filePosition;
            }
            this.lastGCodeByte = filePosition;
            this.processLine(line, lineNumber, filePosition, renderLine);
         } else if (this.slicer && this.slicer.isTypeComment(line)) {
            this.isSupport = this.slicer.isSupport();
            if (this.colorMode === ColorMode.Feature) {
               this.currentColor = this.slicer.getFeatureColor();
            }
         }

         if (Date.now() - this.timeStamp > 10) {
            if (this.loadingProgressCallback) {
               this.loadingProgressCallback(filePosition / file.length, 'Loading File...');
            }
            this.timeStamp = await pauseProcessing();
         }
         this.doUpdate();
      }

      //build the travel mesh
      if (this.renderTravels) {
         await this.createTravelLines(this.scene);
      }

      if (this.loadingProgressCallback) {
         this.loadingProgressCallback(1);
      }
      file = {}; //Clear out the file.
   }

   loadingComplete() {
      this.renderInstances.forEach((inst) => (inst.isLoading = false));
      this.updateFilePosition(Number.MAX_VALUE - 1);
      this.updateFilePosition(Number.MAX_VALUE);
   }

   async processLine(tokenString, lineNumber, filePosition, renderLine = true) {
      //Remove the comments in the line
      let commentIndex = tokenString.indexOf(';');
      if (commentIndex > -1) {
         tokenString = tokenString.substring(0, commentIndex - 1).trim();
      }
      let tokens;

      tokenString = tokenString.toUpperCase();
      let commands = tokenString.match(/[GM]+[0-9.]+/g); //|S+

      if (commands === null) {
         let hasMove = tokenString.match(/[XYZ]+[0-9.]+/);
         if (hasMove !== null) {
            commands = this.lastCommand;
         }
      }

      if (commands) {
         for (let commandIndex = 0; commandIndex < commands.length; commandIndex++) {
            //console.log(`index ${commandIndex} command ${commands[commandIndex]}`);
            switch (commands[commandIndex]) {
               case 'G0':
               case 'G1':
               case 'G00':
               case 'G01':
                  this.g0g1(tokenString, lineNumber, filePosition, renderLine, commands);
                  break;
               case 'G2':
               case 'G3':
               case 'G02':
               case 'G03':
                  this.g2g3(tokenString, lineNumber, filePosition, renderLine);
                  break;
               case 'G10':
                  this.firmwareRetraction = true;
                  break;
               case 'G11':
                  this.firmwareRetraction = false;
                  break;
               case 'G17':
                  this.arcPlane = 'XY';
                  break;
               case 'G18':
                  this.arcPlane = 'XZ';
                  break;
               case 'G19':
                  this.arcPlane = 'YZ';
                  break;
               case 'G20':
                  this.inches = true;
                  break;
               case 'G28':
                  //Home
                  tokens = tokenString.split(/(?=[GXYZ])/);
                  if (tokens.length === 1 || tokenString === "G28 W") {  //G28 W is due to PrusaSlicer command
                     // this.currentPosition = new Vector3(0, 0, 0);
                     this.currentPosition = new Vector3(this.workplaceOffsets[this.currentWorkplace].x, this.workplaceOffsets[this.currentWorkplace].z, this.workplaceOffsets[this.currentWorkplace].y );
                  } else {
                     if (tokens.some((t) => t.trim() === 'X')) {
                        // this.currentPosition.x = 0;
                        this.currentPosition.x = this.workplaceOffsets[this.currentWorkplace].x;
                     }
                     if (tokens.some((t) => t.trim() === 'Y')) {
                        // this.currentPosition.z = 0;
                        this.currentPosition.z = this.workplaceOffsets[this.currentWorkplace].y;
                     }
                     if (tokens.some((t) => t.trim() === 'Z')) {
                        //this.currentPosition.y = 0;
                        this.currentPosition.y = this.workplaceOffsets[this.currentWorkplace].z;
                     }
                  }
                  break;
               case 'G53':
                  //Machine movement - need to think through this one.
                  break;
               case 'G54':
               case 'G55':
               case 'G56':
               case 'G57':
               case 'G58':
               case 'G59':
                  this.currentWorkplace = 54 - Number(commands[commandIndex].substring(1));
                  this.currentPosition = this.workplaceOffsets[this.currentWorkplace].clone();
                  break;
               case 'G59.1':
               case 'G59.2':
               case 'G59.2':
                  this.currentWorkplace = (58.6 - Number(commands[commandIndex].substring(1))) * 10;
                  this.currentPosition = this.workplaceOffsets[this.currentWorkplace].clone();
                  break;
               case 'G90':
                  this.absolute = true;
                  break;
               case 'G91':
                  this.absolute = false;
                  break;
               case 'G92':
                  //this resets positioning, typically for extruder, probably won't need
                  break;
               case 'S':
                  this.hasSpindle = true;
                  break;
               case 'M3':
               case 'M4':
                  {
                     const tokens = tokenString.split(/(?=[SM])/);
                     let spindleSpeed = tokens.filter((speed) => speed.startsWith('S'));
                     spindleSpeed = spindleSpeed[0] ? Number(spindleSpeed[0].substring(1)) : 0;
                     if (spindleSpeed > 0) {
                        this.hasSpindle = true;
                     }
                  }
                  break;
               case 'M567': {
                  this.m567(tokenString);
                  break;
               }
               case 'M600':
                  {
                     try {
                        this.currentTool++;
                        if (this.currentTool >= this.tools.length) {
                           this.currentTool = 0;
                        }
                        if (this.colorMode !== ColorMode.Feed) {
                           this.currentColor = this.tools[this.currentTool].color.clone();
                        }
                     } catch (ex) {
                        console.log(ex);
                     }
                  }
                  break;
            }
            this.lastCommand = commands;
         }
      } else {
         //command is null so we need to check a couple other items.
         if (tokenString.startsWith('T')) {
            //Check if we are really looking at a tool change
            const newTool = Number.parseInt(tokenString.substring(1), 10); //Track the current selected tool (Currently used for Voxel Mode)

            if (!isNaN(newTool)) {
               this.currentPosition.z += 10; //For ASMBL we are going to assume that there is bed movement in a macro for toolchange. (Look into this for other possible sideeffects)

               this.currentTool = newTool;

               if (this.currentTool >= this.tools.length) {
                  this.currentTool = this.currentTool % this.tools.length; //Deal with a lot of manual tool changes
               } else if (newTool < 0) {
                  this.currentTool = 0;
               }

               if (this.colorMode !== ColorMode.Feed) {
                  var extruder = Number(tokenString.substring(1)) % this.extruderCount;
                  if (extruder < 0) extruder = 0;
                  this.currentColor = this.tools[extruder]?.color?.clone() ?? new Color3(1, 0, 0);
               }
            }
         }

         if (this.debug) {
            console.log(tokenString);
         }
      }
      //break lines into manageable meshes at cost of extra draw calls
      if (this.lines.length >= this.meshBreakPoint) {
         //lets build the mesh
         await this.createMesh(this.scene);
         await pauseProcessing();
         this.doUpdate();
         this.meshIndex++;
      }
   }

   renderPointMode(scene) {
      const meshIndex = this.lineMeshIndex;
      this.gcodeLineIndex.push(new Array());
      //point cloud
      this.sps = new PointsCloudSystem('pcs' + meshIndex, 1, scene);

      const l = this.lines;

      const particleBuilder = function (particle, i, s) {
         l[s].renderParticle(particle);
      };

      this.sps.addPoints(this.lines.length, particleBuilder);

      this.sps.buildMeshAsync().then((mesh) => {
         mesh.material.pointSize = 2;
      });
   }

   async createMesh(scene) {
      //Do a z belt fix for layer heights - so far they appear fixed but some values can be off on initial extrusions
      if (this.zBelt) {
         let minlh = this.lines[this.lines.length - 1].layerHeight;
         this.lines.forEach((l) => {
            l.layerHeight = minlh;
         });
      }

      let renderer;
      if (this.renderVersion === RenderMode.Line || this.renderVersion === RenderMode.Point) {
         renderer = new LineRenderer(scene, this.specularColor, this.loadingProgressCallback, this.renderFuncs, this.tools, this.meshIndex);
      } else if (this.renderVersion === RenderMode.Block) {
         if (this.highQualityExtrusion) {
            renderer = new CylinderRenderer(scene, this.specularColor, this.loadingProgressCallback, this.renderFuncs, this.tools, this.meshIndex);
         } else {
            renderer = new BlockRenderer(scene, this.specularColor, this.loadingProgressCallback, this.renderFuncs, this.tools, this.meshIndex);
         }
      } else if (this.renderVersion === RenderMode.Voxel) {
         renderer = new VoxelRenderer(scene, this.specularColor, this.loadingProgressCallback, this.renderFuncs, this.tools, this.voxelWidth, this.voxelHeight);
      }
      renderer.progressColor = this.progressColor;
      renderer.vertexAlpha = this.vertexAlpha;
      this.renderInstances.push(renderer);

      // for (let idx = 0; idx < this.lines.length; idx++) {
      //    this.renderedLines.push(this.lines[idx]);
      // }

      await renderer.render(this.lines);
      this.lines = [];

      //this.scene.render();
   }

   chunk(arr, chunkSize) {
      var R = [];
      for (var i = 0, len = arr.length; i < len; i += chunkSize) R.push(arr.slice(i, i + chunkSize));
      return R;
   }

   async createTravelLines(scene) {
      const chunks = this.chunk(this.travels, 20000);
      for (let idx = 0; idx < chunks.length; idx++) {
         const renderer = new LineRenderer(scene, this.specularColor, this.loadingProgressCallback, this.renderFuncs, this.tools, this.meshIndex);
         renderer.travels = true;
         renderer.meshIndex = this.meshIndex + 1000;
         await renderer.render(chunks[idx]);
         this.renderInstances.push(renderer);
      }
      this.travels = []; //clear out the travel array after creating the mesh
   }

   updateFilePosition(filePosition) {
      //Some renderers will ahve multiple instances like block and line
      this.renderInstances.forEach((r) => r.updateFilePosition(filePosition));
      try {
         if (filePosition < this.renderedLines[this.lastFilePositionIndex].gcodeFilePosition) {
            this.lastFilePositionIndex = 0;
            this.currentLineNumber = 0;
         }
      } catch {
         this.lastFilePositionIndex = 0;
         this.currentLineNumber = 0;
      }

      for (let i = this.lastFilePositionIndex; i < this.renderedLines.length; i++) {
         if (this.renderedLines[i].gcodeFilePosition > filePosition) {
            break;
         }
         this.currentLineNumber = this.renderedLines[i].gcodeLineNumber;
         this.nozzlePosition = this.renderedLines[i].end;
         this.lastFilePositionIndex = i;
      }
      this.doUpdate();
   }

   doFinalPass() {
      this.liveTracking = true;
      this.gcodeFilePosition = Number.MAX_VALUE;
      setTimeout(() => {
         this.liveTracking = false;
      }, this.refreshTime + 200);
   }

   updateMesh() {
      if (this.renderVersion === 1) {
         console.log('Version 1');
      } else if (this.renderVersion === 2) {
         console.log('Version 2');
      }
   }

   unregisterEvents() {
      for (let idx = 0; idx < this.renderFuncs.length; idx++) {
         this.scene.unregisterBeforeRender(this.renderFuncs[idx]);
         delete this.renderFuncs[idx];
      }
      this.renderFuncs = [];

      for (let idx = 0; idx < this.renderInstances.length; idx++) {
         delete this.renderInstances[idx];
      }
      this.renderInstances = [];
   }

   setLiveTracking(enabled) {
      this.liveTracking = enabled;
   }

   setColorMode(mode) {
      if (!mode) {
         this.colorMode = ColorMode.Color;
      }
      localStorage.setItem('processorColorMode', mode);
      this.colorMode = mode;
   }

   updateMinFeedColor(value) {
      localStorage.setItem('minFeedColor', value);
      this.minFeedColorString = value;
      this.minFeedColor = Color4.FromHexString(value.padEnd(9, 'F'));
   }

   updateMaxFeedColor(value) {
      localStorage.setItem('maxFeedColor', value);
      this.maxFeedColorString = value;
      this.maxFeedColor = Color4.FromHexString(value.padEnd(9, 'F'));
   }

   updateColorRate(min, max) {
      localStorage.setItem('minColorRate', min);
      localStorage.setItem('maxColorRate', max);
      this.minColorRate = min;
      this.maxColorRate = max;
   }

   updateForceWireMode(enabled) {
      this.forceWireMode = enabled;
      localStorage.setItem('forceWireMode', enabled);
   }

   setLiveTrackingShowSolid(value) {
      this.liveTrackingShowSolid = value;
      localStorage.setItem('showSolid', value);
   }

   setAlpha(alpha) {
      this.vertexAlpha = alpha;
   }

   resetTools() {
      this.tools = new Array();
   }

   addTool(color, diameter, toolType = ToolType.Extruder) {
      const tool = new Tool();
      tool.color = Color4.FromHexString(color.padEnd(9, 'F'));
      tool.diameter = diameter;
      tool.toolType = toolType;
      this.tools.push(tool);
   }

   updateTool(color, diameter, index) {
      if (index < this.tools.length) {
         this.tools[index].color = Color4.FromHexString(color.padEnd(9, 'F'));
         this.tools[index].diameter = diameter;
      }
   }

   /* Force reset the render instances */
   forceRedraw() {
      for (let idx = 0; idx < this.renderInstances.length; idx++) {
         this.renderInstances[idx].forceRedraw = true;
      }
      this.doUpdate();
   }

   useHighQualityExtrusion(active) {
      this.highQualityExtrusion = active;
   }

   setVoxelMode(active) {
      this.forceVoxels = active;
   }

   useSpecularColor(useSpecular) {
      const color = useSpecular ? new Color3(0.4, 0.4, 0.4) : new Color3(0, 0, 0);
      this.specularColor = color;
      this.renderInstances.forEach((r) => {
         if (r.material !== null && Object.prototype.hasOwnProperty.call(r.material, 'specularColor')) {
            try {
               r.material.specularColor = color;
            } catch (ex) {
               console.error(ex);
            }
         }
      });
      if (this.scene) {
         this.scene.render(true, true);
      }
   }

   g1AsExtrusion(active) {
      this.g1AsExtrusion = active;
   }

   async cancel() {
      this.cancelLoad = true;
      await this.pauseProcessing();
   }

   setZBeltAngle(angle) {
      this.gantryAngle = ((90 - angle) * Math.PI) / 180;
      this.hyp = Math.cos(this.gantryAngle);
      this.adj = Math.tan(this.gantryAngle);
   }
}
