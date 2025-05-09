const testing = true; 

// configuration  
const config = {
  dataPath: 'data/tableaux_embeddings.json',
  pointSize: 0.25,
  validColor: 0x33aaff,
  invalidColor: 0xff3366
};

// define materials for data points 
const pointMaterialValid = new THREE.MeshStandardMaterial({
  color: config.validColor,
  emissive: config.validColor,
  emissiveIntensity: 0.3,
  metalness: 0.3,
  roughness: 0.4
});

const pointMaterialInvalid = new THREE.MeshStandardMaterial({
  color: config.invalidColor,
  emissive: config.invalidColor,
  emissiveIntensity: 0.3,
  metalness: 0.3,
  roughness: 0.4
});

let pointEntities = []
let tableauxData = [];
let hoveredPoint = null; 
let clickedPoint = null; 

// initialize scene 
let scene, camera;

AFRAME.registerComponent('tableaux-scene', {
  init: function() {
      loadTableauxData();
      camera = document.getElementById('camera').getObject3D('camera');
  }
});

document.querySelector('a-scene').setAttribute('tableaux-scene', '');

// load data 
function loadTableauxData() {
  fetch(config.dataPath)
      .then(response => {
          if (!response.ok) {
              throw new Error(`error: ${response.status}`);
          }
          return response.json();
      })
      .then(data => {

          // create point cloud 
          tableauxData = data;
          createPointCloud(data); 
      })
      .catch(error => {
          console.error('Error loading data:', error);
      });
}


function createPointCloud(tableauxData) {
  const pointCloudContainer = document.getElementById('point-cloud');
  const progressBar = document.getElementById('progress');
  const loading = document.getElementById('loading');
  
  // define regular and low dimensional spheres 
  const geometry = new THREE.SphereGeometry(config.pointSize, 8, 8);
  const lowDetailGeometry = new THREE.SphereGeometry(config.pointSize, 4, 4);
  
  // draw points in batches for efficiency 
  const batchSize = 100;
  let currentBatch = 0;
  processBatch();

  // helper function - draw points in batches 
  function processBatch() {
    let totalBatches = Math.ceil(tableauxData.length/batchSize);
    const start = currentBatch * batchSize;
    const end = Math.min(start + batchSize, tableauxData.length);
    
    for (let i = start; i < end; i++) {
      const data = tableauxData[i];
        
      // create entity in a-frame (container to store point)
      const pointEntity = document.createElement('a-entity');
      pointEntity.setAttribute('data-cluster', data.is_cluster);
      pointEntity.setAttribute('data-index', i)
      pointEntity.setAttribute('data-raycastable', '');

      const scale = 15; 
      pointEntity.setAttribute('position', `${data.x * scale} ${data.y * scale} ${data.z * scale}`);
      pointCloudContainer.appendChild(pointEntity);
      
      // make meshes - low resolution and high resolution for optimizing performance 
      const material = data.is_cluster ? pointMaterialValid.clone() : pointMaterialInvalid.clone();
      
      // make mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.index = i;
      mesh.userData.isCluster = data.is_cluster;
      pointEntity.object3D.add(mesh);

      // make low resolution mesh
      const lodMesh = new THREE.Mesh(lowDetailGeometry, material.clone());
      lodMesh.visible = false; // don't show low resolution 
      lodMesh.userData.index = i;
      lodMesh.userData.isCluster = data.is_cluster;
      pointEntity.object3D.add(lodMesh);

      // store in pointEntities 
      pointEntities.push({
        entity: pointEntity,
        mesh: mesh,
        lodMesh: lodMesh,
        data: data
      });   
    }
    
    // update progress bar 
    const progress = Math.round((end / tableauxData.length) * 100);
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
    
    if (testing) // this is just for debugging - if i am testing then I don't need to display all the points each time 
      currentBatch += 5; 
    else
      currentBatch++;

    if (currentBatch < totalBatches) {
        // process next batch
        setTimeout(processBatch, 0); 
    } else {
        console.log('done drawing points');
        setupInteractions(); 
        //setupControls(); 
        loading.style.display = 'none';
    }
  }
}

// set up interactions
function setupInteractions() {
  
  // performance optimization - decreasing resolution of some points 
  function updateLOD() {
      /** helper function - update resolution based on camera position  */
      if (!camera) return; // error handling 
      
      pointEntities.forEach(point => {
          const distance = camera.position.distanceTo(point.entity.object3D.position);

          // if it is close to the camera use high resolution 
          const useHighDetail = distance < config.lodThreshold; 
          
          // switch the visible and invisible meshes if needed 
          if (point.mesh.visible != useHighDetail) {
              point.mesh.visible = useHighDetail;
              point.lodMesh.visible = !useHighDetail;
          }
      });
  }

  // update low resolution things when the camera moves 
  document.getElementById('camera').addEventListener('componentchanged', (evt) => {
    if (evt.detail.name === 'position') {
      updateLOD();
    }
  });

  // helper function to get the mouseOver point 
  function getMouseOverPoint(){
    // calculate mouse position
    mouse.x = (event.clientX/window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY/window.innerHeight) * 2 + 1;
      
    // get all the meshes that the raycaster intersects 
    raycaster.setFromCamera(mouse, camera);
    const meshes = pointEntities.map(p => p.mesh);
    const lodMeshes = pointEntities.map(p => p.lodMesh);
    const allMeshes = [...meshes, ...lodMeshes];
    const intersects = raycaster.intersectObjects(allMeshes);

    if (intersects.length > 0){
      const object = intersects[0].object;
      return object; 
    }
    return null; 
  }

  // hover interactions 
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // mouse move handler for hover effects
  document.addEventListener('mousemove', (event) => {
      
    // reset previous hover
    if (hoveredPoint) {
      const material = hoveredPoint.material;
      const isCluster = hoveredPoint.userData.isCluster;
      if (hoveredPoint != clickedPoint){
        material.emissiveIntensity = 0.3;
        material.color.setHex(isCluster ? config.validColor : config.invalidColor);
      }
      hoveredPoint = null;
    }

    // check if you're hovering over a data point 
    const hoveringOverPoint = getMouseOverPoint()
      
    // set new hover
    if (hoveringOverPoint) { 
      const pointIndex = hoveringOverPoint.userData.index; 
      const pointData = tableauxData[pointIndex];
          
      if (pointData) {
        hoveredPoint = hoveringOverPoint;
        const material = hoveringOverPoint.material;
        material.emissiveIntensity = 0.8;
        material.color.setHex(0xffff00); // Highlight color  
      }
    }
  });

  document.addEventListener('click', (event) => {
    if (!camera) return;

    // reset previous click
    if (clickedPoint) {
      const material = clickedPoint.material;
      const isCluster = clickedPoint.userData.isCluster;
      material.emissiveIntensity = 0.3;
      material.color.setHex(isCluster ? config.validColor : config.invalidColor);
      clickedPoint = null;
    }

    // check if you clicked on a data point  
    const clickingPoint = getMouseOverPoint(); 

    if (clickingPoint) {
      const pointIndex = clickingPoint.userData.index;
      const pointData = tableauxData[pointIndex];

      if (pointData) {
        clickedPoint = clickingPoint;
        const material = clickingPoint.material;
        material.emissiveIntensity = 0.8;
        material.color.setHex(0xffff00); // highlight color  
        showTableauInfo(pointData);
      }
      
    }

    //console.log('intersections:', intersects.length);
    
  });    
}


function showTableauInfo(data) {
  const infoPanel = document.getElementById('tableauInfo');
  if (!data || !data.tableau) return; // error handling for if there is no data 

  // get coordinates of the point on the screen 
  const vector = new THREE.Vector3();
  vector.setFromMatrixPosition(clickedPoint.parent.matrixWorld); 
  vector.project(camera); 

  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;


  // define ssyt html (tbh i used chatgpt for this but i guess it just makes the tableau with the numbers) 
  const tableauHTML = `
    <table style="border-collapse: collapse; margin-top: 8px;">
      ${data.tableau.map(row => `
        <tr>
          ${row.map(n => `
            <td style="
              border: 1px solid #000;
              width: 30px;
              height: 30px;
              text-align: center;
              vertical-align: middle;
              font-size: 16px;
              font-family: serif;
            ">${n}</td>
          `).join('')}
        </tr>
      `).join('')}
    </table>
  `;

  // make info panel with close button 
  infoPanel.innerHTML = `
    <button id="closeInfoPanel">x</button>
    <div style="margin-bottom: 8px;"><strong>Cluster Variable:</strong> ${data.is_cluster ? 'Yes' : 'No'}</div>
    <div style="margin-bottom: 4px;"><strong>SSYT:</strong></div>
    ${tableauHTML}
  `;

  // position the info panel 
  const panelWidth = 250;  
  const panelHeight = 200; 

  let posX = x + 10;
  let posY = y;

  if (posX + panelWidth > window.innerWidth) {
    posX = window.innerWidth - panelWidth - 10;
  }

  if (posY + panelHeight > window.innerHeight) {
    posY = window.innerHeight - panelHeight - 10;
  }

  infoPanel.style.left = `${posX}px`;
  infoPanel.style.top = `${posY}px`;


  // event listener for close button
  document.getElementById('closeInfoPanel').onclick = () => {
    infoPanel.style.display = 'none';
  };

  infoPanel.style.display = 'block';
}
