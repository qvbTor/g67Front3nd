import React, { useRef, useState } from "react";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as ImagePicker from 'expo-image-picker';
import {
    PanResponder,
    Button,
    View,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Text,
    ScrollView,
    TextInput,
    Alert,
} from "react-native";

export default function App() {

    const vertexShader = `
varying vec3 vPosition;
void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

    const fragmentShader = `
varying vec3 vPosition;
void main() {
    gl_FragColor = vec4(abs(vPosition), 1.0); // Gradient effect based on position
}
`;

    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const rotation = useRef({ y: 0 });
    const [height, setHeight] = useState(''); // State for height input
    const modelRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);

    const loadModel = async (scene, url) => {
        setIsLoading(true);
        const objLoader = new OBJLoader();

        return new Promise((resolve, reject) => {
            objLoader.load(
                url,
                (object) => {
                    if (modelRef.current) {
                        scene.remove(modelRef.current);
                    }

                    const box = new THREE.Box3().setFromObject(object);
                    const center = box.getCenter(new THREE.Vector3());

                    const pivot = new THREE.Object3D();
                    pivot.add(object);
                    object.position.sub(center);

                    // Assign unique materials to individual objects
                    let colorIndex = 0;
                    const colors = [0xFFDBD3, 0xE116C3, 0x0000ff]; // Example colors: red, green, blue

                    object.traverse((child) => {
                        if (child.isMesh) {
                            const color = colors[colorIndex % colors.length]; // Cycle through colors
                            child.material = new THREE.MeshStandardMaterial({
                                color,
                                roughness: 0.5,
                                metalness: 0.5,
                            });

                            // Increment the color index for the next object
                            colorIndex++;
                        }
                    });

                    modelRef.current = pivot;
                    scene.add(pivot);

                    setIsLoading(false);
                    resolve();
                },
                undefined,
                (error) => {
                    console.error("Error loading .obj file:", error);
                    setIsLoading(false);
                    reject(error);
                }
            );
        });
    };


    const onContextCreate = async (gl) => {
        const renderer = new Renderer({ gl });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Load the background from the URL
        const textureLoader = new THREE.TextureLoader();
        const backgroundTexture = textureLoader.load(
            "https://cdna.artstation.com/p/assets/images/images/066/755/696/large/bruno-ferrari-sastreria.jpg?1693694999",
            () => {
                scene.background = backgroundTexture; // Set as the scene background
                console.log("Background loaded successfully");
            },
            undefined,
            (error) => {
                console.error("Error loading background image:", error);
            }
        );

        const camera = new THREE.PerspectiveCamera(
            75,
            gl.drawingBufferWidth / gl.drawingBufferHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 3);
        cameraRef.current = camera;

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);

        const flaskServerURL = "http://192.168.100.11:5000/model";
        await loadModel(scene, flaskServerURL);

        const render = () => {
            requestAnimationFrame(render);
            if (modelRef.current) {
                modelRef.current.rotation.y = rotation.current.y;
            }
            renderer.render(scene, camera);
            gl.endFrameEXP();
        };

        render();
    };


    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gestureState) => {
            const sensitivity = 0.001;
            rotation.current.y += gestureState.dx * sensitivity;
        },
    });

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Permission to access camera roll is required!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedImage(result.assets[0].uri);
        } else {
            alert('No image was selected!');
        }
    };

    const handleImageUpload = async () => {
        if (!selectedImage) {
            alert('No image selected.');
            return;
        }

        if (!height || isNaN(height) || height <= 0) {
            alert('Please enter a valid height.');
            return;
        }

        const flaskServerURL = "http://192.168.100.11:5000/upload";
        try {
            const base64Image = selectedImage.startsWith('data:image')
                ? selectedImage.split(',')[1]
                : null;

            const response = await fetch(flaskServerURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    file: base64Image,
                    filename: 'uploaded_image.jpg',
                    height: parseFloat(height), // Include height in the request
                }),
            });

            const data = await response.json();
            if (response.ok) {
                alert("Image uploaded successfully: " + data.message);
            } else {
                alert("Failed to upload image: " + data.error);
            }
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Error uploading image: " + error.message);
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        const flaskServerGenerateURL = "http://192.168.100.11:5000/generate";
        try {
            const response = await fetch(flaskServerGenerateURL, { method: "POST" });
            if (!response.ok) throw new Error("Failed to generate model");
            const data = await response.json();
            alert("Success: " + data.message);
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReloadModel = async () => {
        if (sceneRef.current) {
            setIsLoading(true);
            const flaskServerURL = "http://192.168.100.11:5000/model";
            try {
                await loadModel(sceneRef.current, flaskServerURL);
                alert("Success: Model reloaded successfully");
            } catch (error) {
                alert("Error: Could not reload model");
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <View style={styles.container}>
            <Modal visible={isLoading} transparent={true}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0000ff" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </Modal>

            <GLView
                style={styles.glView}
                onContextCreate={onContextCreate}
                {...panResponder.panHandlers}
            />
            <TextInput
                style={styles.input}
                placeholder="Enter height (in meters)"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
            />
            <Button title="Pick Image" onPress={handlePickImage} />
            <View style={styles.buttonContainer}>
                <Button title="Upload Image" onPress={handleImageUpload} />
                <Button title="Generate" onPress={handleGenerate} />
                <Button title="Reload Model" onPress={handleReloadModel} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    glView: {
        flex: 1,
        width: "100%",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#fff",
    },
    imageInfoContainer: {
        maxHeight: 50, // Limit height to prevent pushing buttons off-screen
        marginVertical: 10,
    },
    imageInfoText: {
        fontSize: 14,
        textAlign: "center",
    },
    buttonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginVertical: 10,
    },
});
