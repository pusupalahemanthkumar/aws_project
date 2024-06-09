import AWS from "/var/runtime/node_modules/aws-sdk/lib/aws.js";

// S3
const BUCKET_NAME = process.env.BUCKET_NAME;

// SCRIPT IN S3
const SCRIPT_FILE_NAME = process.env.SCRIPT_FILE_NAME;
const OUTPUT_FILE_NAME = process.env.OUTPUT_FILE_NAME;

// VM
const IMAGE_ID = process.env.IMAGE_ID;
const REGION = process.env.REGION;
const INSTANCE_TYPE = process.env.INSTANCE_TYPE
const KEY_NAME = process.env.KEY_NAME
const SECURITY_GROUPIDS = [process.env.SECURITY_GROUPIDS];
const IAM_ROLE = process.env.IAM_ROLE

const EC2_USER_DATA_TO_EXECUTE_S3_BASH_SCRIPT = `#!/bin/bash
    BUCKET_NAME=${BUCKET_NAME}
    SCRIPT_NAME=${SCRIPT_FILE_NAME}
    REGION=${REGION}
    LOCAL_SCRIPT_PATH="/tmp/$SCRIPT_NAME"
    
    yum update -y
    yum install -y aws-cli
    
    echo "Done With AWS CLI installation!!"
    
    echo "AWS S3 SCRIPT DOWNLOADING ......"
    aws s3 cp s3://$BUCKET_NAME/$SCRIPT_NAME $LOCAL_SCRIPT_PATH --region $REGION
    chmod +x $LOCAL_SCRIPT_PATH
    $LOCAL_SCRIPT_PATH
    
    echo "Done With S3 Script Execution !!"
    
    # Fetch a session token for IMDSv2
    TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
    
    # Fetch instance ID using the token
    INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/instance-id")
    echo "INSTANCE_ID: $INSTANCE_ID"
    
    # Fetch region using the token
    REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/placement/region")
    echo "REGION: $REGION"
    
    # Terminating instance
    echo "Terminating instance $INSTANCE_ID in region $REGION"
    TERMINATION_OUTPUT=$(aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region $REGION --output json 2>&1)
    

    echo "EC2 USER DATA Script execution completed."
    `;

const VM_PARAMS = {
  ImageId: IMAGE_ID,
  InstanceType: INSTANCE_TYPE,
  MinCount: 1,
  MaxCount: 1,
  KeyName: KEY_NAME,
  UserData: Buffer.from(EC2_USER_DATA_TO_EXECUTE_S3_BASH_SCRIPT).toString(
    "base64"
  ),
  IamInstanceProfile: {
            Name: IAM_ROLE 
        },
  SecurityGroupIds: SECURITY_GROUPIDS,
  TagSpecifications: [
            {
                ResourceType: 'instance',
                Tags: [
                    {
                        Key: 'Name',
                        Value: 'BATCH_JOB_VM'
                    }
                ]
            }
        ]
};

const ec2 = new AWS.EC2({ region: REGION });
const s3 = new AWS.S3();

export const handler = async (event, context) => {
  try {
    let instanceId;
    console.log("even.Records : ",event.Records)
    for (const record of event.Records) {
      console.log("record : ", record);
      if (record.eventName === "INSERT") {
        const newItem = AWS.DynamoDB.Converter.unmarshall(
          record.dynamodb.NewImage
        );
        const s3Path = newItem.input_file_path;
        const appendedText = newItem.input_text;
        const bashScript = `#!/bin/bash
            # Variables
            BUCKET_NAME=${BUCKET_NAME}
            INPUT_FILE=${s3Path}
            OUTPUT_FILE=${OUTPUT_FILE_NAME}
            LOCAL_FILE="/tmp/$INPUT_FILE"
            TEXT_TO_APPEND=${appendedText}
            REGION=${REGION}

            # Download the file from S3
            aws s3 cp s3://$BUCKET_NAME/$INPUT_FILE $LOCAL_FILE --region $REGION

           
            # Append text to the file
            #echo "$TEXT_TO_APPEND" >> $LOCAL_FILE
            printf "%s" "$TEXT_TO_APPEND" >> $LOCAL_FILE

            # Upload the new file to S3
            aws s3 cp $LOCAL_FILE s3://$BUCKET_NAME/$OUTPUT_FILE


            # Clean up local file
            rm $LOCAL_FILE

            echo "Successfully updated and uploaded $OUTPUT_FILE to S3"
        `;
        const params = {
          Bucket: BUCKET_NAME,
          Key: SCRIPT_FILE_NAME,
          Body: bashScript,
          ContentType: "text/x-sh",
        };

        // Upload the file to S3
        await s3.putObject(params).promise();
        const data = await ec2.runInstances(VM_PARAMS).promise();
        instanceId = data.Instances[0].InstanceId;
        console.log(`Created instance with ID: ${instanceId}`);

        // await ec2
        //   .waitFor("instanceRunning", { InstanceIds: [instanceId] })
        //   .promise();
        // console.log(`Instance ${instanceId} is running`);
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "EC2 instance created successfully",
        instanceId: instanceId,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to create EC2 instance",
        error: error.message,
      }),
    };
  }
};
