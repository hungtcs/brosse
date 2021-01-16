import del from 'del';
import path from 'path';
import gulp from 'gulp';
import gulpIf from 'gulp-if';
import minimist from 'minimist';
import gulpSass from 'gulp-sass';
import undertaker from 'undertaker';
import gulpTerser from 'gulp-terser';
import mergeStream from 'merge-stream';
import gulpNodemon from 'gulp-nodemon';
import gulpSourcemaps from 'gulp-sourcemaps';
import gulpTypescript from 'gulp-typescript';
import typescriptPluginFileReplacement from 'typescript-plugin-file-replacement';

interface Options extends minimist.ParsedArgs {
  production: boolean;
}

const options: Options = minimist(process.argv.slice(2), {
  boolean: ['production', 'watch'],
  default: {
    watch: false,
    production: process.env.NODE_ENV === 'production',
  },
}) as unknown as minimist.ParsedArgs & Options;

let gulpNodemonStream: gulpNodemon.EventEmitter;
const gulpIfSourcemapsInit = () => gulpIf(!options.production, gulpSourcemaps.init());
const gulpIfSourcemapsWrite = (_path = './') => gulpIf(!options.production, gulpSourcemaps.write(_path));
const gulpTypescriptCreateProject = (tsconfig: string) => {
  return gulpTypescript.createProject(
    tsconfig,
    {
      typescript: require('ttypescript'),
      getCustomTransformers: (program) => ({
        before: options.production ?
          [
            typescriptPluginFileReplacement(
              program!,
              {
                replacements: [
                  {
                    replace: 'main/env/index.ts',
                    with: 'main/env/index.prod.ts',
                  },
                ]
              },
            ),
          ] : [],
      }),
    },
  );
};

function gulpTaskIf(condition: boolean, task: gulp.TaskFunction): undertaker.TaskFunction {
  const newTask: undertaker.TaskFunction = (callback) => {
    if(condition) {
      gulp.series(task)(callback);
    } else {
      callback();
    }
  };
  return (newTask.displayName = task.name, newTask);
}

export function clean() {
  return del([
    'dist/**/*',
  ]);
}

function assets() {
  return mergeStream(
    gulp.src('renderer/index.html').pipe(gulp.dest('dist/renderer')),
    gulp.src('renderer/assets/**/*').pipe(gulp.dest('dist/renderer/assets')),
  );
}

function styles() {
  return gulp.src('renderer/styles/**/*.{sass,scss}')
    .pipe(gulpIfSourcemapsInit())
    .pipe(gulpSass({ outputStyle: options.production ? 'compressed' : 'expanded' }).on('error', gulpSass.logError))
    .pipe(gulpIfSourcemapsWrite())
    .pipe(gulp.dest('dist/renderer/styles'));
}

function electronMainScripts() {
  const project = gulpTypescriptCreateProject(path.join(__dirname, 'tsconfig.main.json'));
  return gulp.src('main/**/*.ts')
    .pipe(gulpIfSourcemapsInit())
    .pipe(project())
    .pipe(gulpIf(options.production, gulpTerser()))
    .pipe(gulpIfSourcemapsWrite())
    .pipe(gulp.dest('dist/main'));
}

function electronRendererScripts() {
  const project = gulpTypescriptCreateProject(path.join(__dirname, 'tsconfig.renderer.json'));
  return gulp.src('renderer/**/*.ts')
    .pipe(gulpIfSourcemapsInit())
    .pipe(project())
    .pipe(gulpIf(options.production, gulpTerser()))
    .pipe(gulpIfSourcemapsWrite())
    .pipe(gulp.dest('dist/renderer'));
}

function nodemon() {
  gulpNodemonStream = gulpNodemon();
  gulpNodemonStream.on('crash', () => gulpNodemonStream.emit('restart'))
  return Promise.resolve();
}

// function nodemonRestart() {
//   gulpNodemonStream && gulpNodemonStream.emit('restart');
//   return Promise.resolve();
// }

function watch() {
  gulp.watch(['renderer/index.html', 'renderer/assets/**/*'], assets);
  gulp.watch('renderer/styles/**/*.{sass,scss}', styles);
  gulp.watch('main/**/*.ts', gulp.parallel(electronMainScripts));
  gulp.watch('renderer/**/*.ts', electronRendererScripts);
  return Promise.resolve();
}

exports.build = gulp.series(
  clean,
  gulp.parallel(
    assets,
    styles,
    electronMainScripts,
    electronRendererScripts,
  ),
  gulpTaskIf(options.watch, gulp.parallel(watch, nodemon)),
);
