import AWS from "aws-sdk";
import axios from "axios";

export const bucketName = process.env.REACT_APP_AWS_S3_BUCKET_NAME;
export const awsRegionName = process.env.REACT_APP_AWS_REGION_NAME;
export const awsAccessKeyId = process.env.REACT_APP_AWS_ACCESS_KEY_ID;
export const awsSecretAccessKey = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;

export const apiGatewayURI = process.env.REACT_APP_AWS_API_KEY_GATE_WAY_URI;

export const S3Utils = async (file) => {
  AWS.config.update({
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  });

  const s3 = new AWS.S3({
    params: {
      Bucket: bucketName,
    },
    region: awsRegionName,
  });

  return s3;
};

export const StoreInS3 = async (payload) => {
  const s3 = await S3Utils();
  return s3
    .putObject(payload)
    .on("httpUploadProgress", (e) => {
      console.log(`Upload Status : ${parseInt((e.loaded * 100) / e.total)} % `);
    })
    .promise();
};

export const storeMetaDataInDynamoDB = async (payload) => {
  const config = {
    headers: {
      "Content-Type": "application/json",
    },
  };
  try {
    console.log(apiGatewayURI);
    const { data } = await axios.post(apiGatewayURI, payload, config);
    console.log(data);
    return data;
  } catch (err) {
    console.log(err);
  }

  return {};
};
