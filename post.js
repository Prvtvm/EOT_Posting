const axios = require('axios');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const cron = require('node-cron');

const clientId = 'sb-3ebb297b-4023-4d94-9926-007f970db6b5!b6931|iotae_service!b940';
const clientSecret = 'c9c580b5-9206-408e-90f5-e2509d89f1e6$djKJZg7ppzMvSl7jQ7YIfagknKEpzNCpUwGipwYV-h0=';
const tokenGenerationUrl = 'https://assetmagmt.authentication.eu20.hana.ondemand.com/oauth/token?grant_type=client_credentials';
const postUrl = 'https://iot-ts-data-sap.cfapps.eu20.hana.ondemand.com/Timeseries/v1/Measurements';

// Function to generate access token for fetching data
async function generateFetchAuthToken(clientId, clientSecret) {
    try {
        console.log('Generating access token for fetching data...');
        const response = await axios.post(tokenGenerationUrl, null, {
            auth: { username: clientId, password: clientSecret }
        });
        console.log('Fetch data access token generated successfully.');
        return response.data.access_token;
    } catch (error) {
        console.error('Error generating fetch data access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Function to generate access token for posting data
async function generatePostAuthToken(clientId, clientSecret) {
    try {
        console.log('Generating access token for posting data...');
        const response = await axios.post(tokenGenerationUrl, null, {
            auth: { username: clientId, password: clientSecret }
        });
        console.log('Post data access token generated successfully.');
        return response.data.access_token;
    } catch (error) {
        console.error('Error generating post data access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function fetchResponse(authToken) {
    console.log('Fetching response...');
    try {
        const currentDate = new Date();
        const formattedDate = currentDate.toISOString();
        const response = await axios.get(postUrl, {
            params: {
                fromTime: '2024-03-30T00:00:00.000Z', // Fixed date or change as needed
                toTime: formattedDate,
                objectId: 'E_20024005'
            },
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log('Response fetched successfully.');
        
        const folderName = 'responses';
        const fileName = 'response.json';
        const filePath = path.join(__dirname, folderName, fileName);
        
        const responseData = JSON.stringify(response.data, null, 2);
        
        await fs.promises.writeFile(filePath, responseData);
        console.log(`Response saved as "${filePath}"`);
        
        return filePath;
    } catch (error) {
        console.error('Error fetching response:', error.response ? error.response.data : error.message);
        throw error;
    }
}

function removeNull(obj) {
    for (const key in obj) {
        if (obj[key] === null) {
            delete obj[key];
        } else if (typeof obj[key] === 'object') {
            removeNull(obj[key]);
        }
    }
    return obj;
}

async function postData() {
    try {
        const accessToken = await generatePostAuthToken(clientId, clientSecret);
        
        const filePath = path.join(__dirname, 'responses', 'response.json');
        const jsonData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        
        const values = convertToValuesArray(jsonData.Values);
        
        const requestBody = {
            Tags: {
                objectId: "E_20024003",
                CategoryId: "M",
                Position: "P_3a9aa01d12db411fb3b6088e5623faf5"
            },
            Values: values
        };

        const response = await axios.post(postUrl, requestBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Data posted successfully:', response.data);
    } catch (error) {
        console.error('Error posting data:', error.response ? error.response.data : error.message);
    }
}

function convertToValuesArray(jsonData) {
    return jsonData.map(item => ({
        C_1399: item.C_1399 ? item.C_1399.toString() : null,
        C_1400: item.C_1400 ? item.C_1400.toString() : null,
        C_1398: item.C_1398 ? item.C_1398.toString() : null,
        _time: item._time || new Date().toISOString()
    }));
}


async function saveExcelFile(objectId, flattenedData) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(flattenedData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const folderName = "Feed";
    const excelFileName = `${objectId}.xlsx`;
    const excelFilePath = path.join(folderName, excelFileName);
    XLSX.writeFile(workbook, excelFilePath);
    console.log(`Excel file saved as "${excelFilePath}"!`);
}

async function executeScript() {
    try {
        const fetchAuthToken = await generateFetchAuthToken(clientId, clientSecret);
        const postAuthToken = await generatePostAuthToken(clientId, clientSecret);
        const filePath = await fetchResponse(fetchAuthToken);
        const jsonData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        const cleanedData = removeNull(jsonData);
        const measuresData = cleanedData.Values ? cleanedData.Values.map(item => item.Measures) : [];
        const flattenedData = measuresData.reduce((acc, val) => acc.concat(val), []);
        await saveExcelFile('E_20024003', flattenedData);
        await postData(postAuthToken);
    } catch (error) {
        console.error('Error executing script:', error);
    }
}

// Schedule the cron job to run at 6 am on Monday and Wednesday
cron.schedule('0 6 * * 1,3', () => {
    console.log('Running script...');
    executeScript();
}, {
    timezone: 'Asia/Kolkata' // India timezone
});

console.log('Script scheduled to run at 6 am on Monday and Wednesday in India timezone.');