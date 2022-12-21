import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import "@babylonjs/loaders/OBJ/"
import { JRNozzle } from './models'

export class CursorType {

}

export default class ToolCursor {

    constructor(scene){ 
        this.scene = scene
        this.toolCursor
        this.toolCursorMesh
        this.toolCursorVisible = true
    }

    loadNozzleMesh(){
        if (this.toolCursor !== undefined) return
        this.toolCursor = new TransformNode('toolCursorContainer')
        SceneLoader.ShowLoadingScreen = false;
        SceneLoader.Append('', JRNozzle, this.scene, undefined, undefined, undefined, ".obj")
        this.toolCursorMesh = this.scene.getMeshByName("JRNozzle");
        this.toolCursorMesh.parent = this.toolCursor
        this.toolCursorMesh.rotate(Axis.X, Math.PI / 2, Space.LOCAL)
        this.toolCursorMesh.rotate(Axis.Y, Math.PI, Space.LOCAL)
        this.toolCursorMesh.rotate(Axis.Z, Math.PI , Space.LOCAL)
        this.toolCursorMesh.scaling = new Vector3(-1,1,1)
        this.toolCursorMesh.isVisible = this.toolCursorVisible
        this.toolCursorMesh.renderingGroupId = 2
        this.registerClipIgnore(this.toolCursorMesh)
    
        let mat = new StandardMaterial('nozzleMaterial', this.scene)
        this.toolCursorMesh.material = mat;
        mat.diffuseColor = new Color3(1.0, 0.766, 0.336)
    }

    
}