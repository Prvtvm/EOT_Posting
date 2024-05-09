const axios = require('axios');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const cron = require('node-cron');

const clientId = 'sb-3ebb297b-4023-4d94-9926-007f970db6b5!b6931|iotae_service!b940';
const clientSecret = 'c9c580b5-9206-408e-90f5-e2509d89f1e6$djKJZg7ppzMvSl7jQ7YIfagknKEpzNCpUwGipwYV-h0=';
const tokenGenerationUrl = 'https://assetmagmt.authentication.eu20.hana.ondemand.com/oauth/token?grant_type=client_credentials';
const postUrl = 'https://iot-ts-data-sap.cfapps.eu20.hana.ondemand.com/Timeseries/v1/Measurements';

async function generateAuthToken(clientId, clientSecret) {
    try {
        console.log('Generating access token...');
        const response = await axios.post(tokenGenerationUrl, null, {
            auth: { username: clientId, password: clientSecret }
        });
        console.log('Access token generated successfully.');
        return response.data.access_token;
    } catch (error) {
        console.error('Error generating access token:', error.response ? error.response.data : error.message);
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
        
        // Save the response as a JSON file in a folder
        const folderName = 'responses';
        const fileName = 'response.json';
        const filePath = path.join(__dirname, folderName, fileName);
        
        // Convert response data to JSON string
        const responseData = JSON.stringify(response.data, null, 2);
        
        // Write JSON data to file
        await fs.promises.writeFile(filePath, responseData);
        console.log(`Response saved as "${filePath}"`);
        
        return filePath; // Return the file path
    } catch (error) {
        console.error('Error fetching response:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function postData() {
    try {
        // Get access token
        const accessToken = await generateAuthToken(clientId, clientSecret);
        
        // Read JSON data from file
        const filePath = path.join(__dirname, 'responses', 'response.json');
        const jsonData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        
        // Convert Excel data to Values array
        const values = convertToValuesArray(jsonData.Values);
        
        // Construct the request body
        const requestBody = {
            Tags: {
                objectId: "E_20024003", // You may modify this objectId as needed
                CategoryId: "M",
                Position: "P_3a9aa01d12db411fb3b6088e5623faf5"
            },
            Values: values
        };

        // Post data with access token
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

// Function to convert Excel data to the Values array: it's the accepted JSON format.
function convertToValuesArray(jsonData) {
    return jsonData.map(item => ({ // using map utility iterating over each item row-wise: basically modification of values.
        C_1399: item.C_1399 ? item.C_1399.toString() : null,
        C_1400: item.C_1400 ? item.C_1400.toString() : null,
        C_1398: item.C_1398 ? item.C_1398.toString() : null,
        _time: item._time || new Date().toISOString() // Include _time field or use current timestamp if not available
    }));
}


// Function to save Excel file with the name derived from objectId
async function saveExcelFile(objectId, flattenedData) {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Add worksheet
    const worksheet = XLSX.utils.json_to_sheet(flattenedData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // Define the folder name
    const folderName = "Feed";

    // Define the output file path with the folder name
    const excelFileName = `${objectId}.xlsx`;
    const excelFilePath = path.join(folderName, excelFileName);

    // Write workbook to XLSX file with the specified path
    XLSX.writeFile(workbook, excelFilePath);

    console.log(`Excel file saved as "${excelFilePath}"!`);
}

async function executeScript() {
    try {
        const authToken = await generateAuthToken(clientId, clientSecret);
        const filePath = await fetchResponse(authToken);
        const jsonData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));

        // Remove null values from JSON data
        const cleanedData = removeNull(jsonData);
        
        // Check if cleanedData.Values exists before attempting to access it
        const measuresData = cleanedData.Values ? cleanedData.Values.map(item => item.Measures) : [];
        
        // Flattening the array of arrays into a single array of objects
        const flattenedData = measuresData.reduce((acc, val) => acc.concat(val), []);
        
        // Save Excel file with objectId as filename
        await saveExcelFile('E_20024003', flattenedData);

        // Call postData to post data
        await postData();
    } catch (error) {
        console.error('Error executing script:', error);
    }
}

// Function to remove null values recursively from an object
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

executeScript();
