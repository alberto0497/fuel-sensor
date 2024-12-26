// Función para generar una tabla a partir de los datos de dispositivos
function generateTable(data) {
    if (!data || data.length === 0) {
        return '<p>No se encontraron datos en la API.</p>';
    }

    let table = '<table>';
    table += `
        <thead>
            <tr>
                <th>ID</th>
                <th>Device ID</th>
                <th>Nombre</th>
                <th>ID_GPS</th>
                <th>Fuel Sensor Label</th>
                <th>Fuel Sensor Units</th>
                <th>Fuel Sensor Max Value</th>
                <th>Fuel Sensor Current Value</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.forEach((item) => {
        table += `
            <tr>
                <td>${item.id || 'N/A'}</td>
                <td>${item.label || 'N/A'}</td>
                <td>${item.source?.device_id || 'N/A'}</td>
                <td>${item.source?.id || 'N/A'}</td>
                <td>${item.fuelSensor?.label || 'No disponible'}</td>
                <td>${item.fuelSensor?.units || 'No disponible'}</td>
                <td>${item.fuelSensor?.max_value || 'No disponible'}</td>
                <td>${item.fuelSensor?.value || 'No disponible'}</td>
            </tr>
        `;
    });

    table += '</tbody></table>';
    return table;
}

// Función para crear un gráfico de tanque de combustible
function createFuelGauge(canvasId, currentValue, maxValue) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const percentage = (currentValue / maxValue) * 100;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['DISPONIBLE', 'USADO'],
            datasets: [
                {
                    data: [currentValue, maxValue - currentValue],
                    backgroundColor: ['#FF6384', '#36A2EB'],
                    borderWidth: 0,
                },
            ],
        },
        options: {
            responsive: true,
            cutout: '80%',
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return tooltipItem.raw + ' L'; // Muestra el valor en litros
                        },
                    },
                },
                title: {
                    display: true,
                    text: `Nivel del tanque (${currentValue} L de ${maxValue} L)`,
                },
            },
        },
    });
}

// Función para obtener la información del usuario usando el hash
async function getUserInfo(hash) {
    const apiUrl = `https://api.navixy.com/v2/user/get_info?hash=${hash}`;
    try {
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            return {
                name: data.user_info?.title || 'Nombre no disponible',
                id: data.user_info?.id || 'ID no disponible',
            };
        } else {
            throw new Error('No se pudo obtener la información del usuario.');
        }
    } catch (error) {
        console.error('Error al obtener la información del usuario:', error);
        return { name: 'Error al obtener nombre', id: 'Error al obtener ID' };
    }
}

// Función para obtener el sensor de combustible de un dispositivo
async function getFuelSensor(hash, trackerId) {
    const apiUrl = `https://api.navixy.com/v2/tracker/get_fuel?hash=${hash}&tracker_id=${trackerId}`;
    try {
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            const fuelSensor = data.inputs?.find((input) => input.label === 'Tanque de 35.000 L');
            return fuelSensor || { label: 'No disponible', units: '-', max_value: '-', value: '-' };
        } else {
            throw new Error(`Error al obtener datos de combustible para tracker_id=${trackerId}`);
        }
    } catch (error) {
        console.error(`Error al obtener el sensor de combustible para tracker_id=${trackerId}:`, error);
        return { label: 'Error', units: '-', max_value: '-', value: '-' };
    }
}

// Función para cargar los datos desde la API
async function fetchData() {
    const hash = '4f9079566be6b376107cd07ed8f5592c'; // Reemplaza con tu session_key
    const dataContainer = document.getElementById('data');
    const userContainer = document.getElementById('userInfo');

    // Mostrar un mensaje mientras se cargan los datos
    dataContainer.innerHTML = '<p>Cargando datos...</p>';
    userContainer.innerHTML = '<p>Cargando información del usuario...</p>';

    try {
        const response = await fetch(`https://api.navixy.com/v2/tracker/list?hash=${hash}`);

        if (!response.ok) {
            throw new Error(`Error al cargar los datos: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.list) {
            throw new Error('La respuesta no contiene el campo "list".');
        }

        const userInfo = await getUserInfo(hash);
        userContainer.innerHTML = `
            <p>Cliente: <b>${userInfo.name}</b></p>
            <p>ID°: <b>${userInfo.id}</b></p>
        `;

        const devicesWithFuel = await Promise.all(
            data.list.map(async (device) => {
                const fuelSensor = await getFuelSensor(hash, device.id);
                return { ...device, fuelSensor };
            })
        );

        const tableHTML = generateTable(devicesWithFuel);
        dataContainer.innerHTML = tableHTML;

        // Crear el gráfico del tanque para el primer dispositivo
        const firstDevice = devicesWithFuel[0];
        if (firstDevice && firstDevice.fuelSensor) {
            const { value, max_value } = firstDevice.fuelSensor;
            createFuelGauge('fuelGauge', value || 0, max_value || 0);
        }
    } catch (error) {
        console.error('Error durante la solicitud:', error);
        dataContainer.innerHTML = `<p>Error: ${error.message}</p>`;
        userContainer.innerHTML = `<p>Error: ${error.message}</p>`;
    }
}

// Ejecutar la función fetchData cuando la página se haya cargado
window.onload = fetchData;
