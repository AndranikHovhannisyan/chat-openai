require('dotenv').config();
const mysql = require('mysql');
const { Configuration, OpenAIApi } = require("openai");


async function bootstrap() {
    const questions = await DB.getQuestions()

    for (const questionEntry of questions) {
        const openAIChoice = await OpenAI.getChoice(questionEntry.question);
        await DB.saveChoice(questionEntry.id, openAIChoice);
    }

    await DB.close()
}

class OpenAI {
    static client = null;

    static getClient() {
        if (OpenAI.client) return OpenAI.client;

        const configuration = new Configuration({apiKey: process.env.OPENAI_API_KEY});
        return OpenAI.client = new OpenAIApi(configuration);
    }

    static async getChoice(prompt) {
        const response = await OpenAI.getClient().createCompletion({
            model: process.env.OPENAI_MODEL,
            prompt: prompt,
            temperature: 0,
            max_tokens: 20,
        });

        return (response?.data?.choices && response?.data?.choices[0] && response?.data?.choices[0].text) || null
    }
}

class DB {
    static connection = null;

    static async connect() {
        if (DB.connection) return DB.connection;

        DB.connection = mysql.createConnection(process.env.MYSQL_URL);
        DB.connection.connect();

        return DB.connection;
    }

    static async close() {
        if (DB.connection) return DB.connection.end();
    }

    static async getQuestions() {
        if (!DB.connection) await DB.connect()
        return new Promise((resolve, reject) => {
            DB.connection.query('SELECT id, question FROM pages WHERE should_crawl IS TRUE AND is_crawled IS FALSE', function (error, results, fields) {
                if (error) throw reject(error);
                resolve(results);
            })
        });
    }

    static async saveChoice(id, choice) {
        if (!DB.connection) await DB.connect()
        return new Promise((resolve, reject) => {
            DB.connection.query(`UPDATE pages SET openai = '${choice}', is_crawled = true WHERE id = ${id}`, function (error, results, fields) {
                if (error) {
                    console.log(error)
                    throw reject(error);
                }
                resolve(results);
            })
        });
    }
}

bootstrap();