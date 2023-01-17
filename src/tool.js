import { Color4 } from "@babylonjs/core/Maths/math.color";

export default class Tool {
    constructor() {
        this.name = '';
        this.color = new Color4(0, 0, 1, 1);
        this.diameter = 0.4; //default nozzle
        this.toolType = ToolType.Extruder;
    }

    get colorString() {
        return this.color.toHexString();
    }

    set colorString(value) {
        this.color = Color4.FromHexString(value + "FF");
    }

    isAdditive() {
        return this.toolType === ToolType.Extruder;
    }

    getDiameter() {
            return this.diameter;
    }

    toJson() {
        return JSON.stringify(this);
    }

    static fromJson(jsonString) {
        let json;
        if (typeof jsonString === 'object') {
            json = jsonString;
        }
        else {
            json = JSON.parse(jsonString);
        }
        let tool = new Tool();
        tool.name = json.name;
        tool.color = new Color4(json.color.r, json.color.g, json.color.b, json.color.a);
        tool.diameter = parseFloat(json.diameter);
        tool.toolType = json.toolType;
        return tool;
    }
}

export const ToolType = {
    Extruder: "Extruder",
    Endmill: "Endmill"
}

let loadedTools = new Array();

export function GetTool() {
    if (loadedTools.length === 0) {
        let toolString = window.localStorage.getItem('tools');
        if (toolString) {
            loadedTools.splice();
            let toolList = JSON.parse(toolString);
            toolList.forEach((t) => {
                let newTool = Tool.fromJson(t);
                loadedTools.push(newTool);
            });

        } else {
            for (let toolIdx = 0; toolIdx < 10; toolIdx++) {
                let tool = new Tool();
                tool.name = 'Tool #' + toolIdx;
                loadedTools.push(tool);
            }
        }
    }
    return loadedTools;

}

export function SaveTool() {
    const toolString = JSON.stringify(loadedTools);
    window.localStorage.setItem('tools', toolString);

}