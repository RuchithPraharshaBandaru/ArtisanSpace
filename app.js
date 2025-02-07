import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;
const hostname = '127.0.0.1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.set('view engine','ejs');
app.get('/auth',(req,res)=>{
    res.render('auth')
})


// Starts an Express server locally on port 3000
app.listen(port, hostname, () => {
  console.log(`Listening on http://${hostname}:${port}/`);
});