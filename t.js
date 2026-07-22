 const center = new THREE.Vector3(0, 0, -50)

    camera.position.set(0, controls.maxDistance, 0)
    camera.zoom = 1
    camera.lookAt(center)

    controls.enableRotate = false
    controls.target.copy(center)

    camera.updateProjectionMatrix()
    controls.update()