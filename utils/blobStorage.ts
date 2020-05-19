import {
  BlobServiceClient,
  BlockBlobUploadResponse
} from "@azure/storage-blob";
import { TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

export interface IBlobStorageParams {
  connectionString: NonEmptyString;
  containerName: NonEmptyString;
}

export interface IBlobStorageService {
  save: (
    blobName: string,
    fileContent: string
  ) => TaskEither<Error, BlockBlobUploadResponse>;
}

export function getRTBlobStorageService(
  blobStorageParams: IBlobStorageParams
): IBlobStorageService {
  return {
    save: (
      blobName: string,
      fileContent: string
    ): TaskEither<Error, BlockBlobUploadResponse> => {
      return tryCatch(
        async () => {
          // Create the BlobServiceClient object which will be used to create a container client
          const blobServiceClient = BlobServiceClient.fromConnectionString(
            blobStorageParams.connectionString
          );
          // Get a reference to a container
          const containerClient = blobServiceClient.getContainerClient(
            blobStorageParams.containerName
          );
          if (!(await containerClient.exists())) {
            await containerClient.create();
            // TODO: Check container creation response
          }
          // Get a block blob client
          const blockBlobClient = containerClient.getBlockBlobClient(blobName);

          return await blockBlobClient.upload(fileContent, fileContent.length);
        },
        _ => new Error(`Error uploading blob document: [${_}]`)
      );
    }
  };
}
