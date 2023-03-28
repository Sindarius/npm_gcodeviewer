import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'

export default class Workplace {
    constructor(scene) {
        //True for now while we start testing
        this.visible = true; 
        this.scene = scene;
        this.workplacePoints = [];
        this.workplaceMeshes = [];
        this.registerClipIgnore = () => { };
    }

    setOffsets(points) {
        this.workplacePoints = points;
        this.render();
    }

   makeTextPlane(text, color, size) {
    var dynamicTexture = new DynamicTexture('DynamicTexture', 50, this.scene, true);
    dynamicTexture.hasAlpha = true;
    dynamicTexture.drawText(text, 5, 40, 'bold 36px Arial', color, 'transparent', true);
    var plane = Mesh.CreatePlane('TextPlane', size, this.scene, true);
    plane.material = new StandardMaterial('TextPlaneMaterial', this.scene);
    plane.material.backFaceCulling = false;
    plane.material.specularColor = new Color3(0, 0, 0);
    plane.material.diffuseTexture = dynamicTexture;
    return plane;
  }

    
    render() {

        //Dispose and rebuild meshes
        if (this.workplaceMeshes.length > 0) {
            for (let idx = 0; idx < this.workplaceMeshes.length; idx++) {
                this.workplaceMeshes[idx].dispose(false, true);
            }
            this.workplaceMeshes = [];
        }

        if (this.visible) {
            for (let idx = 0; idx < this.workplacePoints.length; idx++) {
                const point = this.workplacePoints[idx];
                if (!Vector3.ZeroReadOnly.equals(point)) {
                    const textMesh = this.makeTextPlane(idx + 1, "white", 5);
                    textMesh.position = new Vector3(point.x +1, point.z + 2, point.y);
                    textMesh.billboardMode = 7
                    textMesh.isVisible = true;
                    textMesh.renderingGroupId = 2;
                    this.registerClipIgnore(textMesh);
                    this.workplaceMeshes.push(textMesh);

                    const mesh = MeshBuilder.CreateBox("box", { size: 1 }, this.scene);
                    mesh.renderingGroupId = 2
                    mesh.position = new Vector3(point.x, point.z, point.y);
                    mesh.isVisible = true;
                    this.registerClipIgnore(mesh);
                    this.workplaceMeshes.push(mesh);
                }
            }
        }
    }
}