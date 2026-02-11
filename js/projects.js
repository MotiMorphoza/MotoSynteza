(function () {
  var projects = [
    { title: 'Window to redemption', folder: 'Window to redemption' },
    { title: 'OHHHHH YOUR GOD', folder: 'OHHHHH YOUR GOD' },
    { title: 'uNuSuAll usual', folder: 'uNuSuAll usual' },
    { title: 'Windows - The eyes of the modern soul', folder: 'Windows - The eyes of the modern soul' },
    { title: 'Demon Stration', folder: 'Demon Stration' }
  ];

  var descriptions = {
    'Window to redemption': 'A stark, cinematic glimpse into moments where darkness breaks and a new path appears.',
    'OHHHHH YOUR GOD': 'A loud visual collision of fear, irony, and reverence, framed through raw urban symbolism.',
    'uNuSuAll usual': 'A study of ordinary places made strange through angle, rhythm, and timing.',
    'Windows - The eyes of the modern soul': 'An observational series where glass and reflection become portraits of contemporary life.',
    'Demon Stration': 'An expressive visual narrative balancing provocation with theatrical composition.'
  };

  var listEl = document.getElementById('projects-list');

  function createProjectItem(project, index) {
    var section = document.createElement('section');
    section.className = 'project-item ' + (index % 2 === 0 ? 'bg-1' : 'bg-2') + (index % 2 === 1 ? ' reverse' : '');

    var grid = document.createElement('div');
    grid.className = 'project-grid';

    var media = document.createElement('img');
    media.className = 'project-media';
    media.alt = project.title;

    var text = document.createElement('div');
    text.className = 'project-text';
    text.innerHTML = '<h2>' + project.title + '</h2><p>' + descriptions[project.title] + '</p>';

    if (index % 2 === 0) {
      grid.appendChild(media);
      grid.appendChild(text);
    } else {
      grid.appendChild(text);
      grid.appendChild(media);
    }

    section.appendChild(grid);
    setProjectImage(project, media);

    return section;
  }

  function addSeparator() {
    var sep = document.createElement('div');
    sep.className = 'separator';
    return sep;
  }

  function setProjectImage(project, imageEl) {
    var basePath = 'images/projects/' + project.folder + '/';

    findImageFromDirectory(basePath)
      .then(function (path) {
        imageEl.src = path;
      })
      .catch(function () {
        imageEl.classList.add('placeholder');
      });
  }

  function findImageFromDirectory(basePath) {
    return fetch(basePath)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('No directory listing');
        }
        return response.text();
      })
      .then(function (html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var links = Array.prototype.slice.call(doc.querySelectorAll('a'));
        var imageNames = links
          .map(function (a) {
            return a.getAttribute('href') || '';
          })
          .filter(function (href) {
            return /\.(jpg|jpeg|png|webp|gif)$/i.test(href);
          })
          .sort();

        var coverMatch = imageNames.find(function (name) {
          return /^cover\.(jpg|jpeg|png|webp|gif)$/i.test(name.split('/').pop());
        });

        var selected = coverMatch || imageNames[0];
        if (!selected) {
          throw new Error('No image found');
        }

        return new URL(selected, basePath).toString();
      })
      .catch(function () {
        return probeCommonNames(basePath);
      });
  }

  function probeCommonNames(basePath) {
    var candidates = [
      'cover.jpg',
      'cover.jpeg',
      'cover.png',
      '1.jpg',
      '1.jpeg',
      '1.png',
      '01.jpg',
      '01.jpeg',
      '01.png',
      'image.jpg',
      'image.jpeg',
      'image.png'
    ];

    return new Promise(function (resolve, reject) {
      var i = 0;

      function tryNext() {
        if (i >= candidates.length) {
          reject(new Error('No probe image found'));
          return;
        }

        var src = basePath + candidates[i++];
        var tester = new Image();

        tester.onload = function () {
          resolve(src);
        };

        tester.onerror = tryNext;
        tester.src = src;
      }

      tryNext();
    });
  }

  projects.forEach(function (project, index) {
    listEl.appendChild(createProjectItem(project, index));
    if (index < projects.length - 1) {
      listEl.appendChild(addSeparator());
    }
  });
})();
