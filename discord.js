const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = "!";

client.on("ready", () => {
  console.log("Bot online");
});

// comandos (!seguir / !parar)
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();
  const nome = args.join(" ");

  if (!nome) return message.reply("Informe o nome da obra.");

  const guild = message.guild;

  if (cmd === "seguir") {
    let role = guild.roles.cache.find(r => r.name.toLowerCase() === nome.toLowerCase());

    if (!role) {
      role = await guild.roles.create({
        name: nome
      });
    }

    await message.member.roles.add(role);
    message.reply(`Agora você segue: ${role.name}`);
  }

  if (cmd === "parar") {
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === nome.toLowerCase());

    if (!role) return message.reply("Obra não encontrada.");

    await message.member.roles.remove(role);
    message.reply(`Você parou de seguir: ${role.name}`);
  }
});


// 🔥 PARTE NOVA — webhook → ping automático
client.on("messageCreate", async (message) => {

  // só reage a webhook
  if (!message.webhookId) return;

  const content = message.content;

  // extrai nome da obra
  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) return;

  const nome = match[1].trim();
  const guild = message.guild;

  // procura cargo
  let role = guild.roles.cache.find(r => r.name.toLowerCase() === nome.toLowerCase());

  // cria cargo automaticamente se não existir
  if (!role) {
    role = await guild.roles.create({
      name: nome
    });
  }

  // envia mensagem com ping
  await message.channel.send({
    content: `<@&${role.id}>
${content}`
  });

  // apaga mensagem original do webhook
  await message.delete();
});

client.login(process.env.TOKEN);