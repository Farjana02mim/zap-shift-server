const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const port = process.env.PORT || 5000

// Middleware
app.use(express.json())
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8v42xkx.mongodb.net/?appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    await client.connect()
    console.log('MongoDB connected ✅')

    const db = client.db('zap_shift_db')
    const parcelsCollection = db.collection('parcels')
    const paymentsCollection = db.collection('payments')

    // ==============================
    // PARCEL ROUTES
    // ==============================

    app.get('/parcels', async (req, res) => {
      try {
        const query = {}
        if (req.query.email) {
          query.senderEmail = req.query.email
        }

        const result = await parcelsCollection.find(query).toArray()
        res.send(result)
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch parcels' })
      }
    })

    app.get('/parcels/:id', async (req, res) => {
      try {
        const result = await parcelsCollection.findOne({
          _id: new ObjectId(req.params.id),
        })
        res.send(result)
      } catch {
        res.status(400).send({ error: 'Invalid parcel ID' })
      }
    })

    app.post('/parcels', async (req, res) => {
      try {
        const parcel = req.body
        parcel.createdAt = new Date()
        parcel.paymentStatus = 'pending'

        const result = await parcelsCollection.insertOne(parcel)
        res.send(result)
      } catch {
        res.status(500).send({ error: 'Failed to create parcel' })
      }
    })

    app.delete('/parcels/:id', async (req, res) => {
      try {
        const result = await parcelsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        })
        res.send(result)
      } catch {
        res.status(400).send({ error: 'Invalid parcel ID' })
      }
    })

    // ==============================
    // STRIPE CHECKOUT
    // ==============================

    app.post('/create-checkout-session', async (req, res) => {
      try {
        const { cost, parcelId, senderEmail, parcelName } = req.body

        if (!cost || !parcelId || !senderEmail) {
          return res.status(400).send({ error: 'Missing required fields' })
        }

        const amount = Math.round(Number(cost) * 100)

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: amount,
                product_data: {
                  name: parcelName || 'Parcel Payment',
                },
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          customer_email: senderEmail,
          metadata: {
            parcelId,
            parcelName,
          },
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        })

        res.send({ url: session.url })
      } catch (error) {
        console.error(error)
        res.status(500).send({ error: 'Stripe session creation failed' })
      }
    })

    // ==============================
    // PAYMENT SUCCESS VERIFY
    // ==============================

    app.patch('/payment-success', async (req, res) => {
      try {
        const sessionId = req.query.session_id

        if (!sessionId) {
          return res.status(400).send({ error: 'Session ID missing' })
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId)

        if (session.payment_status !== 'paid') {
          return res.status(400).send({
            success: false,
            message: 'Payment not completed',
          })
        }

        const parcelId = session.metadata.parcelId
        const transactionId = session.payment_intent

        // Prevent duplicate payment insert
        const existingPayment = await paymentsCollection.findOne({
          transactionId,
        })

        if (existingPayment) {
          return res.send({
            success: true,
            message: 'Payment already processed',
          })
        }

        // Update parcel
        const updateResult = await parcelsCollection.updateOne(
          { _id: new ObjectId(parcelId) },
          {
            $set: {
              paymentStatus: 'paid',
              transactionId,
              paidAt: new Date(),
            },
          }
        )

        // Save payment record
        const paymentDoc = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId,
          parcelName: session.metadata.parcelName,
          transactionId,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: '',
        }

        const paymentResult = await paymentsCollection.insertOne(paymentDoc)

        res.send({
          success: true,
          parcelUpdated: updateResult.modifiedCount > 0,
          paymentSaved: paymentResult.insertedId,
        })
      } catch (error) {
        console.error(error)
        res.status(500).send({ success: false })
      }
    })

    await client.db('admin').command({ ping: 1 })
  } finally {
  }
}

run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Zap Shift Server Running 🚀')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})