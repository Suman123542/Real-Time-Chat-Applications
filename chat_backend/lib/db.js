import mongoose from "mongoose";

//Function to connect to mongodb database
export const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}/Chat-Application`)
    console.log('MongoDB connected successfully');
    }
    catch (error) {
        console.log(error);
    }
}