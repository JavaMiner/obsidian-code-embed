class Suite {
    public static void main(String[] args) throws Exception {
        var process = new ProcessBuilder("node", "test/visual-vault/Uruchom/suite.mjs").inheritIO().start();
        System.exit(process.waitFor());
    }
}
