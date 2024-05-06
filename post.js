const axios = require('axios');
const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
const cron = require('node-cron');

// Define a function to execute the script
function executeScript() {
    // Read JSON data from file
    const jsonData = require("C:/response.json");

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

    // Remove null values from JSON data
    const cleanedData = removeNull(jsonData);

    // Extracting the Measures array from cleanedData
    const measuresData = cleanedData.Values.map(item => item.Measures);

    // Flattening the array of arrays into a single array of objects
    const flattenedData = measuresData.reduce((acc, val) => acc.concat(val), []);

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Add worksheet
    const worksheet = XLSX.utils.json_to_sheet(flattenedData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    // Define the folder name
    const folderName = "Feed";

    // Define the output file path with the folder name
    const outputPath = path.join(folderName, 'Temporary.xlsx');

    // Write workbook to XLSX file with the specified path
    XLSX.writeFile(workbook, outputPath);

    console.log(`XLSX file saved as "${outputPath}"!`);

    // Define the file path to out.xlsx in the "Feed" folder
    const filePath = path.join(__dirname, 'Feed', 'Temporary.xlsx');

    // Read data from Excel
    const workbook2 = XLSX.readFile(filePath);
    const sheetName2 = workbook2.SheetNames[0];
    const worksheet2 = workbook2.Sheets[sheetName2]; 

    // Convert Excel data to JSON
    const jsonData2 = XLSX.utils.sheet_to_json(worksheet2);

    // Client credentials
    const clientId = 'sb-3ebb297b-4023-4d94-9926-007f970db6b5!b6931|iotae_service!b940';
    const clientSecret = 'c9c580b5-9206-408e-90f5-e2509d89f1e6$djKJZg7ppzMvSl7jQ7YIfagknKEpzNCpUwGipwYV-h0=';

    // Token generation URL
    const tokenGenerationUrl = 'https://assetmagmt.authentication.eu20.hana.ondemand.com/oauth/token?grant_type=client_credentials';

    // POST URL
    const postUrl = 'https://iot-ts-data-sap.cfapps.eu20.hana.ondemand.com/Timeseries/v1/Measurements';

    // Function to generate access token
    async function generateAccessToken() {
        try {
            const response = await axios.get(tokenGenerationUrl,  { 
                auth: {
                username: clientId,
                password: clientSecret
                } 
            });
            return response.data.access_token;
        } catch (error) {
            console.error('Error generating access token:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    // Function to convert Excel data to the Values array : it the accepted json format.
    function convertToValuesArray(jsonData) {
        return jsonData.map(item => ({ // using map utiity iterating over each item row-wise : basically modification of values.
            C_1399: item.C_1399 ? item.C_1399.toString() : null,
            C_1400: item.C_1400 ? item.C_1400.toString() : null,
            C_1398: item.C_1398 ? item.C_1398.toString() : null,
            _time: item._time
        }));
    }

    // Function to save Excel file with the name derived from objectId
    function saveExcelFile(objectId) {
        const excelFileName = `${objectId}.xlsx`;
        const excelFilePath = path.join(folderName, excelFileName);
        fs.copyFileSync(outputPath, excelFilePath);
        console.log(`Excel file saved as "${excelFilePath}"!`);
    }

    // Function to post data
    async function postData() {
        try {
            // Get access token
            const accessToken = await generateAccessToken();
            
            // Convert Excel data to Values array
            const values = convertToValuesArray(jsonData2);

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
            
            // Save Excel file with objectId as filename
            saveExcelFile(requestBody.Tags.objectId);
        } catch (error) {
            console.error('Error posting data:', error.response ? error.response.data : error.message);
        }
    }

    // Call the function to post data
    postData();
}

// Schedule the cron job to run at 6 am on Monday and Wednesday in India timezone
cron.schedule('0 6 * * 1,3', () => {
    executeScript();
}, {
    timezone: 'Asia/Kolkata' // India timezone
});

console.log('Script scheduled to run at 6 am on Monday and Wednesday in India timezone.');
