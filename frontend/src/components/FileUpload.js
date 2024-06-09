import React from "react";
import { useState } from "react";
import { nanoid } from "nanoid";

import {
  storeMetaDataInDynamoDB,
  StoreInS3,
} from "../utils/AWSUtils.js";
import Loader from "./Loader.js";

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [textInput, setTextInput] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);

  const onFileUpdateHandler = (event) => {
    if (event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const ontextInputChangeHandler = (event) => {
    setTextInput(event.target.value);
  };

  const onUploadFileHandler = async (event) => {
    event.preventDefault();

    try {
      setIsLoading(true);
      let payload = {
        Bucket: process.env.REACT_APP_AWS_S3_BUCKET_NAME,
        Key: file.name,
        Body: file,
      };

      let upload = await StoreInS3(payload);

      console.log("upload ", upload);
      if (
        upload.$response.httpResponse.statusMessage === "OK" &&
        !upload.$response.error
      ) {
        payload = {
          id: nanoid(),
          input_text: `"${textInput}"`,
          input_file_path: file.name,
        };

        await storeMetaDataInDynamoDB(payload);

        setIsLoading(false);
        setIsUploaded(true);

        setTimeout(() => {
          setIsUploaded(false);
        }, 2000);
      }
    } catch (error) {
      setIsLoading(false);
      console.log(error)
    }
  };

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <form className="file-upload-form" onSubmit={onUploadFileHandler}>
          {isUploaded && <p className="success">Uploaded Successfully !!</p>}
          <div className="form-group">
            <label>Text Input</label>
            <input
              type="text"
              onChange={ontextInputChangeHandler}
              required
              value={textInput}
            />
          </div>
          <div className="form-group">
            <label>Please Choose a File</label>
            <input type="file" onChange={onFileUpdateHandler} required />
          </div>
          <button>Upload To S3</button>
        </form>
      )}
    </>
  );
};

export default FileUpload;
