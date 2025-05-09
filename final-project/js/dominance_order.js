const testing = true; 

// configuration  
const config = {
  dataPath: 'data/tableaux_embeddings.json',
  pointSize: 0.25,
  validColor: 0xff3366,
  invalidColor: 0x33aaff
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
        
      // create entity in a-frame 
      const pointEntity = document.createElement('a-entity');
      pointEntity.setAttribute('data-cluster', data.is_cluster);
      pointEntity.setAttribute('data-index', i)
      pointEntity.setAttribute('data-raycastable', '');

      const scale = 50; 
      pointEntity.setAttribute('position', `${data.x_d * scale} ${data.y_d * scale} ${0}`);
      
      pointCloudContainer.appendChild(pointEntity);
        
      // make mesh
      const material = data.is_cluster ? pointMaterialValid.clone() : pointMaterialInvalid.clone();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.index = i;
      mesh.userData.isCluster = data.is_cluster;
      pointEntity.object3D.add(mesh);

      // make low resolution mesh
      const lodMesh = new THREE.Mesh(lowDetailGeometry, material.clone());
      lodMesh.visible = false;
      lodMesh.userData.index = i;
      lodMesh.userData.isCluster = data.is_cluster;
      pointEntity.object3D.add(lodMesh);

      // store in point entities 
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
    
    if (testing) 
      currentBatch += 5; 
    else
      currentBatch++;

    if (currentBatch < totalBatches) {
        // process next batch
        setTimeout(processBatch, 0);
    } else {
        console.log('All points created');
        setupInteractions(); 
        //setupControls(); 
        loading.style.display = 'none';
    }
  }
}

// Set up interactions
function setupInteractions() {
  
  // helper function - update resolution based on camera position 
  function updateLOD() {
      if (!camera) return;
      
      pointEntities.forEach(point => {
          const distance = camera.position.distanceTo(point.entity.object3D.position);
          const useHighDetail = distance < config.lodThreshold;
          
          if (point.mesh.visible !== useHighDetail) {
              point.mesh.visible = useHighDetail;
              point.lodMesh.visible = !useHighDetail;
          }
      });
  }

  // set up raycaster for hover effects
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  
  // mouse move handler for hover effects
  document.addEventListener('mousemove', (event) => {
      // Calculate mouse position
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Update raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Get all meshes
      const meshes = pointEntities.map(p => p.mesh);
      const lodMeshes = pointEntities.map(p => p.lodMesh);
      const allMeshes = [...meshes, ...lodMeshes];
      
      // Find intersections
      const intersects = raycaster.intersectObjects(allMeshes);
      
      // Reset previous hover
      if (hoveredPoint) {
          const material = hoveredPoint.material;
          const isCluster = hoveredPoint.userData.isCluster;
          material.emissiveIntensity = 0.3;
          material.color.setHex(isCluster ? config.validColor : config.invalidColor);
          hoveredPoint = null;
      }

      //console.log('intersections:', intersects.length);

      
      // Set new hover
      if (intersects.length > 0) {
          const object = intersects[0].object;
          //const pointIndex = object.parent.userData.index;
          const pointIndex = object.userData.index;
          const pointData = tableauxData[pointIndex];
          
          if (pointData) {
              hoveredPoint = object;
              const material = object.material;
              material.emissiveIntensity = 0.8;
              material.color.setHex(0xffff00); // Highlight color
              
          }
      }
  });

  document.addEventListener('click', (event) => {
    if (!camera) return;
  
    // Convert click to NDC coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
    // Update raycaster
    raycaster.setFromCamera(mouse, camera);
  
    const allMeshes = [...pointEntities.map(p => p.mesh), ...pointEntities.map(p => p.lodMesh)];
    const intersects = raycaster.intersectObjects(allMeshes);
  
    if (intersects.length > 0) {
      const object = intersects[0].object;
      const pointIndex = object.userData.index;
      const pointData = tableauxData[pointIndex];
      showTableauInfo(pointData);
    }
  });
  
  
  //Update LOD on camera move
  document.getElementById('camera').addEventListener('componentchanged', (evt) => {
      if (evt.detail.name === 'position') {
          updateLOD();
      }
  });
}
function showTableauInfo(data) {
  const infoPanel = document.getElementById('tableauInfo');
  if (!data || !data.tableau) return;

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

  infoPanel.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Cluster Variable:</strong> ${data.is_cluster ? 'Yes' : 'No'}</div>
    <div style="margin-bottom: 4px;"><strong>SSYT:</strong></div>
    ${tableauHTML}
  `;

  infoPanel.style.display = 'block';
}
