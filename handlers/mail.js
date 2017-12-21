const nodemailer = require('nodemailer')
const pug = require('pug')
const juice = require('juice')
const htmlToText = require('html-to-text')
const promisify = require('es6-promisify')


const transport = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  }
});

//Code for sending an email
// transport.sendMail({
//   from: 'Arnaud <arnaud@ambroselli.io>',
//   to: 'bidule@machin.truc',
//   subject: `Reste cool bébé`,
//   html: `On <strong>dance ?</strong> 💃`,
//   text: `On dance ?`
// })

const generateHTML = (filename, options = {}) => {
  const html = pug.renderFile(`${__dirname}/../views/email/${filename}.pug`, options);
  const inlined = juice(html)
  return inlined;
}


exports.send = async (options) => {
  const htmlContent = generateHTML(options.filename, options);
  const textContent = htmlToText.fromString(htmlContent);
  const mailOptions = {
    from: 'Arnaud <arnaud@ambroselli.io>',
    to: options.user.email,
    subject: options.subject,
    html: htmlContent,
    text: textContent
  };

  const sendMailPromisified = promisify(transport.sendMail, transport);
  return sendMailPromisified(mailOptions)
}
