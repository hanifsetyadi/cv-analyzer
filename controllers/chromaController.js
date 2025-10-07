import chromaCollectionPromise from "../services/chromaService.js";

const logSource = "chromaController - "

const addNewDocument = async (jobID, uuid, jobTitle) => {             // need to be fixed later for the status
    try {
        const chromaCollection = await chromaCollectionPromise;

        await chromaCollection.add({
            ids: [jobID],
            documents: [uuid],
            metadatas: [{ job_title: jobTitle, status: 'queued' }]
        });
        console.log(`${logSource} Document added to ChromaDB with ID: ${uuid}`);
    } catch (error) {
        console.error(`${logSource} Error adding document to ChromaDB:`, error);
    }
}

export { addNewDocument };