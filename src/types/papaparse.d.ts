declare module 'papaparse' {
  const Papa: {
    unparse: (data: unknown, config?: unknown) => string;
  };

  export default Papa;
}
