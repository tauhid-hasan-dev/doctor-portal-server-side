const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');

const cors = require('cors');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jjvuikj.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri);
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions')
        const bookingsCollection = client.db('doctorsPortal').collection('bookings')

        app.get('/appoinmentoptions', async (req, res) => {
            const query = {};
            const options = await appointmentOptionsCollection.find(query).toArray();
            res.send(options)
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking)
            const result = await bookingsCollection.insertOne(booking);
            res.send(result)
        })

        /**
         * API naming conventions
         * ===========================
         app.get('/bookings');
         app.get('/bookings/:id');
         app.post('/bookings')
         app.delete('/bookings/:id)
         app.patch('/bookings/:id)
         */


    } finally {

    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Doctors portal server is running');
})

app.listen(port, () => {
    console.log(`Doctors portal is running on ${port}`);
})