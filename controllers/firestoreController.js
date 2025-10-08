import { db } from "../services/firestoreService.js"

const uploadNewDocument = async (uuid, jobID, results) => {
    try {
        await db.collection('LLM-results').doc(uuid).set({
            result: results,
            jobID: jobID,
            createdAt: new Date().toISOString()
        })
        console.log('Document Saved Successfully');
    } catch (error) {
        console.error("Error saving document:", error);
    }
}

const getDocument = async (jobID) => {
    try {
        const snapshot = await db
            .collection("LLM-results")
            .where("jobID", "==", jobID)
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log("No document found for jobID:", jobID);
            return null;
        }

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error("Error getting document by jobID:", error);
        throw new Error("Failed to fetch LLM result by jobID");
    }
}

const uploadErrorDocument = async (id, jobTitle, error) => {
    await db.collection('job_errors').add({
        id,
        jobTitle,
        error: error.message,
        timestamp: new Date().toISOString(),
    });
}

export {
    uploadNewDocument,
    uploadErrorDocument,
    getDocument
}