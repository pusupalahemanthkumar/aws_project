import AWS from "/var/runtime/node_modules/aws-sdk/lib/aws.js";
const s3 = new AWS.S3();

export const handler = async (event, context) => {
  const bucketName = process.env.BUCKET_NAME
  const outputKey = process.env.OUTPUT_FILE_NAME
  try {
    for (const record of event.Records) {
      console.log("Record : ", record);
      if (record.eventName === "INSERT") {
        const newItem = AWS.DynamoDB.Converter.unmarshall(
          record.dynamodb.NewImage
        );

        const s3Path = newItem.input_file_path;
        const appendedText = newItem.input_text;

        let params = {
          Bucket: bucketName,
          Key: s3Path,
        };

        console.log("params : ", params);

        const data = await s3.getObject(params).promise();
        let fileContent = data.Body.toString();
        console.log("fileContent Before : ", fileContent);

        fileContent = fileContent + `\n ${appendedText}`;

        console.log("fileContent After : ", fileContent);

        const outputParams = {
          Bucket: bucketName,
          Key: outputKey,
          Body: fileContent,
        };

        await s3.putObject(outputParams).promise();

        console.log(`File updated and saved as ${outputKey} in S3.`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify("Processing completed."),
    };
  } catch (err) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify("Error processing DynamoDB stream."),
    };
  }
};
