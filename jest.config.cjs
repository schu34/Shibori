/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
        '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.cjs'
    },
    setupFilesAfterEnv: [
        '<rootDir>/jest.setup.cjs'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': [
            'babel-jest',
            {
                presets: [
                    ['@babel/preset-env', { targets: { node: 'current' } }],
                    ['@babel/preset-react', { runtime: 'automatic' }],
                    '@babel/preset-typescript',
                ],
            },
        ],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!.*\\.mjs$)'
    ]
}; 