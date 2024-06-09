import AWS from '/var/runtime/node_modules/aws-sdk/lib/aws.js';
const docClient = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
  console.log("event Data : ",event);
  try {
    const params = {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: event.id,
        input_text: event.input_text,
        input_file_path: event.input_file_path,
      },
    };
    await docClient.put(params).promise();
    return { body: "Successfully created item!" };
  } catch (err) {
    return { error: err };
  }
};