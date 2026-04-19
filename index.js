//importera de bibliotek som behövs
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client } = require("pg");

//skapa server
const app = express();
const PORT = process.env.PORT || 3000;

//middleware. Hade express.urlencoded { extended: true } när det handlade om labb1, formulärdata. 
// Nu är det express.json() då data ska sparas o hämtas från en JSON body
app.use(cors());
app.use(express.json())

//databas
const client = new Client({
    host:process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
})

//tabell
const queryTable = `
CREATE TABLE IF NOT EXISTS works (
    id SERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    jobtitle TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    description TEXT
    )
`;

//det gjorde mig paranoid att se "cannot GET" när jag startade server. Så la till detta nedan
app.get("/", (req, res) => {
    res.send("API server fungerar!");
});

//routes
app.post("/api/works", async (req,res) => {
    try{
        //variabler för vilken data som ska "vara med". Tre sista är ok att lämna tomma
        const company = req.body.company;
        const jobtitle = req.body.jobtitle;
        const start_date = req.body.start_date || null;
        const end_date = req.body.end_date || null;
        const description = req.body.description || null;

        //validering för vad som måste komma med
        if(!company || !jobtitle){
            //skicka status 400 och error meddelande om problemet
            return res.status(400).json({
                error: "company och jobtitle krävs"
            });
        }

        //returning * betyder "returnera hela raden som just skapades". Så man vet/kan se det som skapats
        const result = await client.query(
            `INSERT INTO works (company, jobtitle, start_date, end_date, description)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *`,
            [company, jobtitle, start_date, end_date, description]
        );
        //returnera "Created" status och första objektet i arrayen rows - det som just sparats
        res.status(201).json(result.rows[0]);
    }catch(err){
        res.status(500).json({ error: err.message });
    }
})

app.get("/api/works", async(req, res) => {
    try{
        const result = await client.query("SELECT * FROM works ORDER BY start_date DESC");
        //visa hela resultatet = allt som finns, alla rader
        res.json(result.rows);
    }catch(err){
        //skicka server fel om något inte fungerar
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/works/:id", async (req, res) => {
    try{
        //samma variabler som i post
        const company = req.body.company;
        const jobtitle = req.body.jobtitle;
        const start_date = req.body.start_date || null;
        const end_date = req.body.end_date || null;
        const description = req.body.description || null;

        if(!company || !jobtitle){
            return res.status(400).json({
                error: "company och jobtitle krävs"
            });
        }

        const result = await client.query(
            `UPDATE works SET company=$1, jobtitle=$2, start_date=$3, end_date=$4, description=$5
            WHERE id=$6 
            RETURNING *`,
            [company, jobtitle, start_date, end_date, description, req.params.id]
        );
        //om ingen rad uppdateras så finns inte id
        if(result.rows.length === 0){
            //skicka status "kunde inte hitta"
            res.status(404).json({ error: "Kunde inte hittas. Finns id?"});
            return;
        }
        //om det verkar ok, skicka den uppdaterade datan för raden
        res.status(200).json(result.rows[0]);

    }catch(err){
        res.status(500).json({ error: err.message });
    }
})

app.delete("/api/works/:id", async (req, res) => {
    try{
        const result = await client.query(
            "DELETE FROM works WHERE id=$1 RETURNING *",
            [req.params.id]
        );
        if(result.rows.length === 0){
            res.status(404).json({ error: "Det gick inte att radera. Kontrollera om id stämmer" })
            return;
        }
        res.status(200).json(result.rows[0])
    }catch(err){ 
        res.status(500).json({ error: err.message });
    }
})

//starta server-function. En async, try, catch utifall att något skulle gå fel när den ska "lyssna"
async function startServer() {
    try{
        //vänta på att ansluta
        await client.connect();
        console.log("Uppkopplad till PostgreSQL");
        
        //vänta på förfrågan om tabellens skapande
        await client.query(queryTable);
        console.log("Tabellen har skapats!");

        //lyssna på port
        app.listen(PORT, () => {
            console.log("API fungerar på port: " + PORT);
        })
        
    }catch(err){
        //felhantering vid start.
        //Ingen res.status pga att det inte är en http-request utan sker direkt när servern startas
        console.error("Databas fel:", err);
        return;
    }
}

startServer();