import mongoose from 'mongoose';

await mongoose.connect('mongodb+srv://appzeto:1234567890@ac-vcacra4-shard-00-00.izmf76z.mongodb.net:27017/appzeto?retryWrites=true&w=majority');

const db = mongoose.connection.db;
const restaurants = await db.collection('foodrestaurants').find({}, { projection: { restaurantName: 1, menuPdf: 1 } }).limit(15).toArray();

console.log('\n🔍 Restaurants with menuPdf status:\n');
restaurants.forEach((doc, i) => {
    const hasPdf = doc.menuPdf ? '✅ YES' : '❌ NO';
    console.log(`${i+1}. ${doc.restaurantName}: ${hasPdf}`);
    if (doc.menuPdf) {
        console.log(`   URL: ${doc.menuPdf.substring(0, 80)}...`);
    }
});

process.exit(0);
