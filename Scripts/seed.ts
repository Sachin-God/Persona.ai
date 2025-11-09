const {PrismaClient} = require('@prisma/client');

const db = new PrismaClient();

async function main() {
    try {
        await db.category.createMany({
            data : [
                {name : "Famous People"},
                {name : "Movies & TV"},
                {name : "Musicians"},
                {name : "Games"},
                {name : "Anime"},
                {name : "Comics"},
                {name : "Scientist"},
            ]
        })
    } catch (error) {
        console.log("Error Seeding Default Category : ", error);
    } finally {
        await db.$disconnect();
    }
}

main();