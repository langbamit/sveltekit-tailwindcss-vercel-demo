const prod = process.env.NODE_ENV === 'production';

module.exports = { 
    plugins:[
        require('autoprefixer'),
        require('tailwindcss'),
        prod && require('cssnano')
    ]
};
