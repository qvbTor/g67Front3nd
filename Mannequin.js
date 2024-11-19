import React, { useRef, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { Box3, Vector3 } from 'three';

const Mannequin = () => {
    const groupRef = useRef();
    const obj = useLoader(OBJLoader, 'http://localhost:5000/model'); // Use Flask endpoint

    useEffect(() => {
        if (obj) {
            // Compute the bounding box of the model
            const boundingBox = new Box3().setFromObject(obj);
            const center = new Vector3();
            boundingBox.getCenter(center);

            // Reposition the model so its center aligns with the origin
            obj.position.sub(center);
        }
    }, [obj]);

    return <primitive ref={groupRef} object={obj} />;
};

export default Mannequin;
